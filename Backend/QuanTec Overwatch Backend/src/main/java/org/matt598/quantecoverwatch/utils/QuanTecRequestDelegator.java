package org.matt598.quantecoverwatch.utils;

import java.io.*;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public abstract class QuanTecRequestDelegator {
    public static byte[] handle(String path, String method, String reqContent, String contentType){
        // Forward to QuanTec. TODO block requests based on user class when the images/ and words/ endpoints get implemented.
        try(Socket quantec = new Socket("localhost", 8444)) {

            PrintWriter qtWriter = new PrintWriter(new OutputStreamWriter(quantec.getOutputStream()));
            InputStream qtReader = quantec.getInputStream();

            // Send request with the same method/path as the original request. Return the response from QuanTec verbatim which is then forwarded to the user.
            qtWriter.print(
                    method+" "+path+" HTTP/1.1\r\n" +
                            "Host: localhost\r\n" +
                            "Accept: */*\r\n" +
                            ((reqContent == null || contentType == null) ? "" : "Content-Length: "+reqContent.length()+"\r\n") +
                            (contentType == null ? "" : "Content-Type: "+contentType+"\r\n") +
                            "\r\n" +
                            (reqContent == null ? "" : reqContent)
            );
            qtWriter.flush();

            // TODO QuanTec may use chunked transfer encoding later down the line.
            int content_size = 0;
            byte[] content = null;
            List<String> req = new ArrayList<>();

            while(true){
                String next = readLineFromIS(qtReader);

                if(next.equals("")){
                    // If it's a POST, it has a body and needs to skip this blank, then exit on the next.
                    // Else, it's probably a GET and can exit now.

                    // Check the previous headers for Content-Length, or Transfer-Encoding: chunked, both of which indicate the presence of a body.
                    for(String lines : req){
                        if (lines.toLowerCase().startsWith("content-length: ")){
                            // TODO add assertion that lines.split(" ").length >= 2
                            // TODO chunking support (not used in webapp)
                            content_size = Integer.parseInt(lines.split(" ")[1]);
                        }
                    }

                    // Either we're reading content or digesting the request, either way we can exit this first loop.
                    break;
                }

                req.add(next);
            }

            // If Content-Length != 0, read body into a StringBuilder, then set a state var.
            if(content_size != 0){
                byte[] out = new byte[content_size];
                for (int i = 0; i < out.length; i++) {
                    out[i] = (byte)qtReader.read();
                }

                content = out;
            }

            // Now that we've read that, reassemble it into a string. TODO rewrite this whole method to directly transfer it.
            StringBuilder out = new StringBuilder();

            for(String line : req){
                out.append(line).append("\r\n");
            }
            // It's also *technically* HTTP/1.1 compliant, but it only provides the absolute bare minimum headers (content-length and content-type),
            // so we'll need to add our own to make sure that CORS requests from the front end don't bounce since QuanTec won't send any access control headers.
            out.append(ResponseTemplates.STDHEADERS).append("\r\n");
            byte[] ret;

            if(content != null){
               ret = new byte[out.length()+content.length];
            } else {
                ret = out.toString().getBytes(StandardCharsets.ISO_8859_1);
            }

            // Copy over headers.
            int i = 0;
            for(int j = 0; j < out.toString().length(); j++, i++){
                ret[i] = out.toString().getBytes(StandardCharsets.ISO_8859_1)[j];
            }

            // Copy over content (if present)
            if(content != null){
                for(int j = 0; j < content.length; j++, i++){
                    ret[i] = content[j];
                }
            }

            return ret;
        } catch (IOException e){
            Logging.logError("Request to QuanTec threw an IOException: "+e.getMessage());
            return ResponseTemplates.INTERR.getBytes(StandardCharsets.ISO_8859_1);
        }
    }

    private static String readLineFromIS(InputStream reader) throws IOException {
        List<Character> out = new ArrayList<>();
        char lastRead, temp = '\0';
        while(true){
            lastRead = temp;
            temp = new String(new byte[]{(byte)reader.read()}, StandardCharsets.ISO_8859_1).charAt(0);

            if(temp == '\n' && lastRead == '\r'){
                out.remove(out.size()-1);
                break;
            }

            out.add(temp);
        }

        // Slow manual convert
        char[] outIntermediate = new char[out.size()];
        for (int i = 0; i < outIntermediate.length; i++) {
            outIntermediate[i] = out.get(i);
        }

        return new String(outIntermediate);
    }
}
