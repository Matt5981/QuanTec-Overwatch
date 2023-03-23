package org.matt598.quantecoverwatch.utils.fetch;

import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import java.io.*;
import java.util.ArrayList;
import java.util.List;

// De-bloating the Credential manager. TODO ironically de-bloat this, there's a lot of repeated code.
public abstract class Fetch {
    public static Response DiscordTokenExchange(String client_id, String client_secret, String code, String redirect_uri){
        try(SSLSocket socket = (SSLSocket)SSLSocketFactory.getDefault().createSocket("discord.com", 443)){

            String formData = String.format("client_id=%s&client_secret=%s&grant_type=authorization_code&code=%s&redirect_uri=%s",
                    client_id,
                    client_secret,
                    code,
                    redirect_uri.replaceAll(":", "%3A").replaceAll("/", "%2F")
            );

            String req =
                    "POST /api/v10/oauth2/token HTTP/1.1\r\n" +
                            "Host: discord.com\r\n" +
                            "Accept: application/json\r\n" +
                            "Content-Type: application/x-www-form-urlencoded\r\n" +
                            "Content-Length: "+formData.length()+"\r\n" +
                            "\r\n" +
                            formData;

            PrintWriter writer = new PrintWriter(new OutputStreamWriter(socket.getOutputStream()));
            BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));

            writer.print(req);
            writer.flush();

            // Read response until we read a blank line, on which switch to reading bytes.
            List<String> headers = new ArrayList<>();
            for(String line = reader.readLine(); !line.equals(""); line = reader.readLine()){
                // System.out.println(line);
                headers.add(line);
            }

            // Figure out where Content-Length is and work out what it is. We'll also scan through and check if it's sent Transfer-Encoding: chunked,
            // on which we need to read the body in a weird and painful way.
            int contentLength = 0;
            boolean willUseChunkedEncoding = false;
            for(String line : headers){
                if(line.toLowerCase().startsWith("content-length: ")){
                    contentLength = Integer.parseInt(line.substring(16));
                }
                if(line.equals("Transfer-Encoding: chunked")){
                    willUseChunkedEncoding = true;
                }
            }

            StringBuilder bodyBuilder = new StringBuilder();

            if(!willUseChunkedEncoding) {
                for (int i = 0; i < contentLength; i++) {
                    bodyBuilder.append((char) reader.read());
                }
            } else {
                while(true){
                    StringBuilder nums = new StringBuilder();
                    char temp = (char)reader.read();
                    char lastTemp = '0';
                    while(true){
                        if(temp == '\n' && lastTemp == '\r'){
                            break;
                        } else {
                            if(!(temp == '\r' || temp == '\n')) {
                                nums.append(temp);
                            }
                            lastTemp = temp;
                            temp = (char)reader.read();
                        }
                    }
                    if(Integer.parseInt(nums.toString(), 16) == 0){
                        // Consume final CRLF and break
                        reader.read();
                        reader.read();
                        break;
                    } else {
                        for (int i = 0; i < Integer.parseInt(nums.toString(), 16); i++) {
                            bodyBuilder.append((char) reader.read());
                        }
                        // Consume CRLF and repeat
                        reader.read();
                        reader.read();
                    }
                }
            }

            String body = bodyBuilder.toString();
            // Return response. We have to divide the top header into a few lines first, and null body if it's invalid.
            String httpVers = headers.get(0).split(" ")[0];
            String respCode = headers.get(0).split(" ")[1];

            // TODO is the substring index here guaranteed to be 13?
            String respMess = headers.get(0).substring(13);

            return new Response(Integer.parseInt(respCode), respMess, httpVers, bodyBuilder.length() == 0 ? null : body);

        } catch (IOException e){
            return null;
        }
    }

    public static Response DiscordGetUser(String user_token){
        try(SSLSocket socket = (SSLSocket)SSLSocketFactory.getDefault().createSocket("discord.com", 443)){

            String req =
                    "GET /api/v10/users/@me HTTP/1.1\r\n" +
                            "Host: discord.com\r\n" +
                            "Accept: application/json\r\n" +
                            "Authorization: Bearer " + user_token + "\r\n" +
                            "\r\n";

            PrintWriter writer = new PrintWriter(new OutputStreamWriter(socket.getOutputStream()));
            BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));

            writer.print(req);
            writer.flush();

            List<String> headers = new ArrayList<>();
            for(String line = reader.readLine(); !line.equals(""); line = reader.readLine()){
                headers.add(line);
            }

            // Figure out where Content-Length is and work out what it is. We'll also scan through and check if it's sent Transfer-Encoding: chunked,
            // on which we need to read the body in a weird and painful way.
            int contentLength = 0;
            boolean willUseChunkedEncoding = false;
            for(String line : headers){
                if(line.toLowerCase().startsWith("content-length: ")){
                    contentLength = Integer.parseInt(line.substring(16));
                }
                if(line.equals("Transfer-Encoding: chunked")){
                    willUseChunkedEncoding = true;
                }
            }

            StringBuilder bodyBuilder = new StringBuilder();

            if(!willUseChunkedEncoding) {
                for (int i = 0; i < contentLength; i++) {
                    bodyBuilder.append((char) reader.read());
                }
            } else {
                while(true){
                    StringBuilder nums = new StringBuilder();
                    char temp = (char)reader.read();
                    char lastTemp = '0';
                    while(true){
                        if(temp == '\n' && lastTemp == '\r'){
                            break;
                        } else {
                            if(!(temp == '\r' || temp == '\n')) {
                                nums.append(temp);
                            }
                            lastTemp = temp;
                            temp = (char)reader.read();
                        }
                    }
                    if(Integer.parseInt(nums.toString(), 16) == 0){
                        // Consume final CRLF and break
                        reader.read();
                        reader.read();
                        break;
                    } else {
                        for (int i = 0; i < Integer.parseInt(nums.toString(), 16); i++) {
                            bodyBuilder.append((char) reader.read());
                        }
                        // Consume CRLF and repeat
                        reader.read();
                        reader.read();
                    }
                }
            }

            String body = bodyBuilder.toString();
            String httpVers = headers.get(0).split(" ")[0];
            String respCode = headers.get(0).split(" ")[1];

            // TODO is the substring index here guaranteed to be 13?
            String respMess = headers.get(0).substring(13);

            return new Response(Integer.parseInt(respCode), respMess, httpVers, bodyBuilder.length() == 0 ? null : body);

        } catch (IOException e){
            return null;
        }
    }

    public static Response discordGetGuilds(String user_token){
        try(SSLSocket socket = (SSLSocket)SSLSocketFactory.getDefault().createSocket("discord.com", 443)){

            String req =
                    "GET /api/v10/users/@me/guilds HTTP/1.1\r\n" +
                            "Host: discord.com\r\n" +
                            "Accept: application/json\r\n" +
                            "Authorization: Bearer " + user_token + "\r\n" +
                            "\r\n";

            PrintWriter writer = new PrintWriter(new OutputStreamWriter(socket.getOutputStream()));
            BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));

            writer.print(req);
            writer.flush();

            List<String> headers = new ArrayList<>();
            for(String line = reader.readLine(); !line.equals(""); line = reader.readLine()){
                headers.add(line);
            }

            // Figure out where Content-Length is and work out what it is. We'll also scan through and check if it's sent Transfer-Encoding: chunked,
            // on which we need to read the body in a weird and painful way.
            int contentLength = 0;
            boolean willUseChunkedEncoding = false;
            for(String line : headers){
                if(line.toLowerCase().startsWith("content-length: ")){
                    contentLength = Integer.parseInt(line.substring(16));
                }
                if(line.equals("Transfer-Encoding: chunked")){
                    willUseChunkedEncoding = true;
                }
            }

            StringBuilder bodyBuilder = new StringBuilder();

            if(!willUseChunkedEncoding) {
                for (int i = 0; i < contentLength; i++) {
                    bodyBuilder.append((char) reader.read());
                }
            } else {
                while(true){
                    StringBuilder nums = new StringBuilder();
                    char temp = (char)reader.read();
                    char lastTemp = '0';
                    while(true){
                        if(temp == '\n' && lastTemp == '\r'){
                            break;
                        } else {
                            if(!(temp == '\r' || temp == '\n')) {
                                nums.append(temp);
                            }
                            lastTemp = temp;
                            temp = (char)reader.read();
                        }
                    }
                    if(Integer.parseInt(nums.toString(), 16) == 0){
                        // Consume final CRLF and break
                        reader.read();
                        reader.read();
                        break;
                    } else {
                        for (int i = 0; i < Integer.parseInt(nums.toString(), 16); i++) {
                            bodyBuilder.append((char) reader.read());
                        }
                        // Consume CRLF and repeat
                        reader.read();
                        reader.read();
                    }
                }
            }

            String body = bodyBuilder.toString();
            String httpVers = headers.get(0).split(" ")[0];
            String respCode = headers.get(0).split(" ")[1];

            // TODO is the substring index here guaranteed to be 13?
            String respMess = headers.get(0).substring(13);

            return new Response(Integer.parseInt(respCode), respMess, httpVers, bodyBuilder.length() == 0 ? null : body);

        } catch (IOException e){
            return null;
        }
    }

    public static Response DiscordTokenRevoke(String user_token, String client_id, String client_secret){
        try(SSLSocket socket = (SSLSocket)SSLSocketFactory.getDefault().createSocket("discord.com", 443)){

            String formData = String.format("token=%s&client_id=%s&client_secret=%s",
                    user_token,
                    client_id,
                    client_secret
            );

            String req =
                    "POST /api/v10/oauth2/token/revoke HTTP/1.1\r\n" +
                            "Host: discord.com\r\n" +
                            "Accept: application/json\r\n" +
                            "Authorization: Bearer " + user_token + "\r\n" +
                            "Content-Type: application/x-www-form-urlencoded\r\n" +
                            "Content-Length: "+formData.length()+"\r\n" +
                            "\r\n" +
                            formData;

            PrintWriter writer = new PrintWriter(new OutputStreamWriter(socket.getOutputStream()));
            BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));

            writer.print(req);
            writer.flush();

            List<String> headers = new ArrayList<>();
            for(String line = reader.readLine(); !line.equals(""); line = reader.readLine()){
                headers.add(line);
            }

            // Figure out where Content-Length is and work out what it is. We'll also scan through and check if it's sent Transfer-Encoding: chunked,
            // on which we need to read the body in a weird and painful way.
            int contentLength = 0;
            boolean willUseChunkedEncoding = false;
            for(String line : headers){
                if(line.toLowerCase().startsWith("content-length: ")){
                    contentLength = Integer.parseInt(line.substring(16));
                }
                if(line.equals("Transfer-Encoding: chunked")){
                    willUseChunkedEncoding = true;
                }
            }

            StringBuilder bodyBuilder = new StringBuilder();

            if(!willUseChunkedEncoding) {
                for (int i = 0; i < contentLength; i++) {
                    bodyBuilder.append((char) reader.read());
                }
            } else {
                while(true){
                    StringBuilder nums = new StringBuilder();
                    char temp = (char)reader.read();
                    char lastTemp = '0';
                    while(true){
                        if(temp == '\n' && lastTemp == '\r'){
                            break;
                        } else {
                            if(!(temp == '\r' || temp == '\n')) {
                                nums.append(temp);
                            }
                            lastTemp = temp;
                            temp = (char)reader.read();
                        }
                    }
                    if(Integer.parseInt(nums.toString(), 16) == 0){
                        // Consume final CRLF and break
                        reader.read();
                        reader.read();
                        break;
                    } else {
                        for (int i = 0; i < Integer.parseInt(nums.toString(), 16); i++) {
                            bodyBuilder.append((char) reader.read());
                        }
                        // Consume CRLF and repeat
                        reader.read();
                        reader.read();
                    }
                }
            }

            String body = bodyBuilder.toString();
            String httpVers = headers.get(0).split(" ")[0];
            String respCode = headers.get(0).split(" ")[1];

            // TODO is the substring index here guaranteed to be 13?
            String respMess = headers.get(0).substring(13);

            return new Response(Integer.parseInt(respCode), respMess, httpVers, bodyBuilder.length() == 0 ? null : body);

        } catch (IOException e){
            return null;
        }
    }

    /** <h2>parse QuanTec Response</h2>
     * This is a utility parser to get response data from QuanTec without bloating the delegator, and while
     * maintaining this class as the nexus of inter-app communication. It's the exact same 'read' code as the
     * Discord API methods, but instead of sending a request will simply accept a <code>byte[]</code> of data from QuanTec
     * and parse it into a Response object.
     * @param res The byte[] returned by QuanTec, preferably from the delegator's <code>handle</code> method.
     * @return QuanTec's response. As this uses a BufferedReader to read the body as well, byte data (e.g. files) will likely be unusable.
     * @see org.matt598.quantecoverwatch.utils.QuanTecRequestDelegator
     */
    public static Response parseQuantecResponse(byte[] res){
        try(BufferedReader reader = new BufferedReader(new InputStreamReader(new ByteArrayInputStream(res)))) {

            // Read response until we read a blank line, on which switch to reading bytes.
            List<String> headers = new ArrayList<>();
            for(String line = reader.readLine(); !line.equals(""); line = reader.readLine()){
                // System.out.println(line);
                headers.add(line);
            }

            // Figure out where Content-Length is and work out what it is. We'll also scan through and check if it's sent Transfer-Encoding: chunked,
            // on which we need to read the body in a weird and painful way.
            int contentLength = 0;
            boolean willUseChunkedEncoding = false;
            for(String line : headers){
                if(line.toLowerCase().startsWith("content-length: ")){
                    contentLength = Integer.parseInt(line.substring(16));
                }
                if(line.equals("Transfer-Encoding: chunked")){
                    willUseChunkedEncoding = true;
                }
            }

            StringBuilder bodyBuilder = new StringBuilder();

            if(!willUseChunkedEncoding) {
                for (int i = 0; i < contentLength; i++) {
                    bodyBuilder.append((char) reader.read());
                }
            } else {
                while(true){
                    StringBuilder nums = new StringBuilder();
                    char temp = (char)reader.read();
                    char lastTemp = '0';
                    while(true){
                        if(temp == '\n' && lastTemp == '\r'){
                            break;
                        } else {
                            if(!(temp == '\r' || temp == '\n')) {
                                nums.append(temp);
                            }
                            lastTemp = temp;
                            temp = (char)reader.read();
                        }
                    }
                    if(Integer.parseInt(nums.toString(), 16) == 0){
                        // Consume final CRLF and break
                        reader.read();
                        reader.read();
                        break;
                    } else {
                        for (int i = 0; i < Integer.parseInt(nums.toString(), 16); i++) {
                            bodyBuilder.append((char) reader.read());
                        }
                        // Consume CRLF and repeat
                        reader.read();
                        reader.read();
                    }
                }
            }

            String body = bodyBuilder.toString();
            // Return response. We have to divide the top header into a few lines first, and null body if it's invalid.
            String httpVers = headers.get(0).split(" ")[0];
            String respCode = headers.get(0).split(" ")[1];

            // TODO is the substring index here guaranteed to be 13?
            String respMess = headers.get(0).substring(13);

            return new Response(Integer.parseInt(respCode), respMess, httpVers, bodyBuilder.length() == 0 ? null : body);

        } catch (IOException e){
            return null;
        }
    }
}
