package org.matt598.quantecoverwatch.utils;

import org.matt598.quantecoverwatch.utils.fetch.Fetch;
import org.matt598.quantecoverwatch.utils.fetch.Response;

import java.io.*;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public abstract class QuanTecRequestDelegator {
    public static byte[] handle(String path, String method, String reqContent, String contentType, String userSnowflake, boolean ignorePermissionChecks){
        // Forward to QuanTec. TODO block requests based on user class when the images/ and words/ endpoints get implemented.
        try(Socket quantec = new Socket("localhost", 8444)) {

            if(!ignorePermissionChecks){
                // Check that we have a snowflake provided, that the snowflake is valid, and that the user possessing the snowflake
                // has MANAGE_SERVER in the server they're trying to access, if either the images/ or words/ endpoints are being
                // used.
                if(path.toLowerCase().startsWith("/words") || path.toLowerCase().startsWith("/images")){
                    // Get guild snowflake.
                    // I'd use a switch here, but it's only three cases, and all have distinct handling.
                    String snowflake;
                    if(path.split("/").length == 3){
                        snowflake = path.split("/")[2];
                    } else if(path.split("/").length == 4){
                        if(path.startsWith("/images/tolerance")){
                            snowflake = path.split("/")[3];
                        } else {
                            snowflake = path.split("/")[2];
                        }
                    } else {
                        // malformed request.
                        return ResponseTemplates.FORBIDDEN.getBytes();
                    }

                    // Check if snowflake is a valid long.
                    try {
                        Long.parseLong(snowflake);
                    } catch (NumberFormatException e){
                        return ResponseTemplates.FORBIDDEN.getBytes();
                    }

                    // Check user snowflake.
                    try {
                        Long.parseLong(userSnowflake);
                    } catch (NumberFormatException e){
                        return ResponseTemplates.FORBIDDEN.getBytes();
                    }

                    // Send request to quantec to get the list of servers the user has MANAGE_SERVER in.
                    byte[] qtRes = handle("/users/manageserver/"+userSnowflake, "GET", null, null, null, true);
                    Response response = Fetch.parseQuantecResponse(qtRes);
                    if(response == null){
                        return ResponseTemplates.FORBIDDEN.getBytes();
                    }
                    if(response.getResponseCode() != 200){
                        return ResponseTemplates.FORBIDDEN.getBytes();
                    }

                    Pattern jsonExtractor = Pattern.compile("(?<=\")[0-9]*?(?=\")");
                    Matcher jsonExtract = jsonExtractor.matcher(response.getResponse());

                    if(!jsonExtract.find()){
                        // No manage servers.
                        return ResponseTemplates.FORBIDDEN.getBytes();
                    }

                    // Loop them all into a list, then if the list contains the target guild, allow it to proceed, else exit.
                    List<String> guilds = new ArrayList<>();
                    do {
                        guilds.add(jsonExtract.group());
                    } while(jsonExtract.find());

                    if(!guilds.contains(snowflake)){
                        return ResponseTemplates.FORBIDDEN.getBytes();
                    }
                }

                // If user tries to query /users/manageserver on somebody that isn't themselves, reject.
                if(path.toLowerCase().startsWith("/users/manageserver")){
                    if(path.split("/").length != 4 || userSnowflake == null){
                        return ResponseTemplates.FORBIDDEN.getBytes();
                    } else if(!userSnowflake.equals(path.split("/")[3])) {
                        return ResponseTemplates.FORBIDDEN.getBytes();
                    }
                }
            }

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
