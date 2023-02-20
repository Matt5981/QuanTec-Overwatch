package org.matt598.quantecoverwatch.utils;

import java.io.*;
import java.net.Socket;
import java.util.ArrayList;
import java.util.List;

public abstract class QuanTecRequestDelegator {
    public static String handle(String request){
        // Forward to QuanTec. TODO block requests based on user class when the images/ and words/ endpoints get implemented.
        try(Socket quantec = new Socket("localhost", 8444)) {

            PrintWriter qtWriter = new PrintWriter(new OutputStreamWriter(quantec.getOutputStream()));
            BufferedReader qtReader = new BufferedReader(new InputStreamReader(quantec.getInputStream()));

            // Send GET with the same PATH as the request. Return the response from QuanTec verbatim which is then forwarded to the user.
            qtWriter.print(
                    "GET "+request+" HTTP/1.1\r\n" +
                            "Host: localhost\r\n" +
                            "Accept: application/json\r\n" +
                            "\r\n"
            );
            qtWriter.flush();

            // TODO QuanTec may use chunked transfer encoding later down the line.
            int content_size = 0;
            String content = null;
            List<String> req = new ArrayList<>();

            while(true){
                String next = qtReader.readLine();

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
                StringBuilder builder = new StringBuilder();
                while(content_size > 0){
                    builder.append((char)qtReader.read());
                    content_size--;
                }

                content = builder.toString();
            }

            // Now that we've read that, reassemble it into a string. TODO rewrite this whole method to directly transfer it.
            StringBuilder out = new StringBuilder();

            for(String line : req){
                out.append(line).append("\r\n");
            }
            out.append("\r\n").append(content);

            return out.toString();
        } catch (IOException e){
            Logging.logError("Request to QuanTec threw an IOException: "+e.getMessage());
            return ResponseTemplates.INTERR;
        }
    }
}
