package org.matt598.quantecoverwatch.clients;

import org.matt598.quantecoverwatch.commands.LXDUtils;
import org.matt598.quantecoverwatch.credentials.CredentialManager;
import org.matt598.quantecoverwatch.utils.Format;
import org.matt598.quantecoverwatch.utils.Logging;
import org.matt598.quantecoverwatch.utils.ResponseTemplates;

import java.io.*;
import java.net.Socket;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class Client extends Thread {
    private final Socket client;
    private PrintWriter toClient;
    private BufferedReader fromClient;
    private final CredentialManager credentialManager;

    public Client(Socket client, CredentialManager credentialManager){
        this.client = client;
        this.credentialManager = credentialManager;

        try {
            this.toClient = new PrintWriter(new OutputStreamWriter(client.getOutputStream()));
            this.fromClient = new BufferedReader(new InputStreamReader(client.getInputStream()));

            this.start();
        } catch (IOException e){
            e.printStackTrace();
        }
    }

    @Override
    public void run(){
        try {
            boolean did_receive_connection_close = false;
            while(true){
                if(did_receive_connection_close) {
                    this.client.close();
                    return;
                }
                boolean requested_chunked_encoding = false;
                int content_size = 0;
                String content = null;
                List<String> req = new ArrayList<>();

                while(true){
                    String next = fromClient.readLine();

                    if(next.equals("")){
                        // If it's a POST, it has a body and needs to skip this blank, then exit on the next.
                        // Else, it's probably a GET and can exit now.

                        // Check the previous headers for Content-Length, or Transfer-Encoding: chunked, both of which indicate the presence of a body.
                        for(String lines : req){
                            if (lines.toLowerCase().startsWith("content-length: ")){
                                // TODO add assertion that lines.split(" ").length >= 2
                                // TODO chunking support (not used in webapp)
                                content_size = Integer.parseInt(lines.split(" ")[1]);
                            } else if(lines.toLowerCase().startsWith("transfer-encoding: ")){
                                if(lines.contains("chunked")){
                                    requested_chunked_encoding = true;
                                }
                            }
                        }

                        // Either we're reading content or digesting the request, either way we can exit this first loop.
                        break;
                    }

                    req.add(next);
                }

                // If chunked encoding requested, send back 400 and close the connection.
                if(requested_chunked_encoding){
                    toClient.print(ResponseTemplates.CHUNKING);
                    toClient.flush();

                    this.client.close();
                    return;
                }

                // If Content-Length != 0, read body into a stringbuilder, then set a state var.
                if(content_size != 0){
                    StringBuilder builder = new StringBuilder();
                    while(content_size > 0){
                        builder.append((char)fromClient.read());
                        content_size--;
                    }

                    content = builder.toString();
                }

                // Break down headers into a hashmap. This makes them much easier to deal with.
                boolean malformed_header_found = false;
                Map<String, String> headers = new HashMap<>();
                if(req.size() > 1){
                    for (int i = 1; i < req.size(); i++) {

                        String[] comp = req.get(i).split(": ");
                        if(comp.length < 2){
                            malformed_header_found = true;
                            break;
                        }

                        headers.put(comp[0].toLowerCase(), comp[1]);
                    }
                }

                if(headers.get("connection").equalsIgnoreCase("close")){
                    did_receive_connection_close = true;
                }

                if(malformed_header_found){
                    Logging.logInfo("Bad header received, returning 400.");
                    toClient.print(ResponseTemplates.BADREQ);
                    toClient.flush();
                    continue;
                }

                // Check for OPTIONS, which can be sent unauthenticated wherever so CORS can be used by the front end.
                // TODO is this secure?
                if(req.get(0).startsWith("OPTIONS")){
                    // TODO add check here that returns 403 if Origin is not one of our domains
                    toClient.print(ResponseTemplates.CORSOPTIONS(headers.get("origin")));
                    toClient.flush();
                    continue;
                }

                // Check for a POST request to /auth, which is an auth request and must be handled through a separate method
                // to de-clutter this method.
                if(req.get(0).startsWith("POST /auth")){
                    authenticate(content);
                    continue;
                }

                // Auth check. Here we just need to get the client's bearer token, feed it to the credential manager,
                // and respond accordingly. However, there's a few instances of things going wrong: No auth header,
                // malformed/invalid auth header, or invalid token, hence the three checks here.
                // Check for auth header's presence.
                if(headers.get("authorization") == null){
                    // Return 401.
                    toClient.print(ResponseTemplates.UNAUTH);
                    toClient.flush();
                    continue;
                }

                // Check auth header's value, making sure that it's bearer.
                if(headers.get("authorization").split(" ").length != 2){
                    // Return 401.
                    toClient.print(ResponseTemplates.UNAUTH);
                    toClient.flush();
                    continue;
                }
                if(!headers.get("authorization").split(" ")[0].equals("Bearer")){
                    // Return 401.
                    toClient.print(ResponseTemplates.UNAUTH);
                    toClient.flush();
                    continue;
                }

                // Check token, finally.
                String username = this.credentialManager.checkToken(headers.get("authorization").split(" ")[1]);
                if(username == null){
                    // Return 401.
                    toClient.print(ResponseTemplates.UNAUTH);
                    toClient.flush();
                    continue;
                }

                // We now have an authenticated, hopefully complete request. If it's a GET, then we've been browsed to and can
                // safely ignore it with a boilerplate page.
                if(req.get(0).startsWith("GET")){
                    toClient.print(ResponseTemplates.GET);
                    toClient.flush();
                    continue;
                }

                // If it's a POST, then it's an actual API request, and we need to service it.
                if(req.get(0).startsWith("POST")){
                    // Work out what it wants, which will be in the message body.
                    // For now, we'll only support it if the content type is text/plain, which means a command. Anything else is a 400.
                    if(headers.get("content-type").startsWith("text/plain")){
                        // Switch on the body.

                        if(content == null){
                            toClient.print(ResponseTemplates.BADREQ);
                            toClient.flush();
                            continue;
                        }

                        // Try to split content by '\n's, which for settings POSTs splits them into the command and the
                        // accompanying JSON. Worst case for commands with no JSON, it'll still have a line we can split
                        // for commands.
                        String[] lines = content.split("\n");

                        switch(lines[0]){
                            case "GETUSERSETTINGS" -> {

                                // Retrieve this client's credential set via token, then send the string stored
                                // in the credential set object.
                                toClient.print(ResponseTemplates.GETSETTINGS(credentialManager.getUserPrefs(username), credentialManager.getUserClass(username)));
                                toClient.flush();
                                continue;
                            }

                            case "UPDATEUSERSETTINGS" -> {
                                // Requesting that we update user settings, make the credential manager do it and send
                                // back a 204.
                                if(lines.length < 2){
                                    toClient.print(ResponseTemplates.BADREQ);
                                    toClient.flush();
                                    continue;
                                }
                                credentialManager.setUserPrefs(username, lines[1]);
                                toClient.print(ResponseTemplates.LOGOUT);
                                toClient.flush();
                                continue;
                            }

                            case "SHUTDOWN" -> {
                                // TODO
                                toClient.print(ResponseTemplates.INTERR);
                                toClient.flush();
                                continue;
                            }

                            case "LOGOUT" -> {
                                // Revoke the client's token at their request, then send back a final 203.
                                // Conveniently, if we got this far then we don't need to do any sanity checks,
                                // since they were done when we authed.
                                credentialManager.revokeToken(headers.get("authorization").split(" ")[1]);
                                toClient.print(ResponseTemplates.LOGOUT);
                                toClient.flush();
                                continue;
                            }

                            case "GETMEMUSAGE" -> {
                                toClient.print(ResponseTemplates.SysInfo());
                                toClient.flush();
                                continue;
                            }

                            case "GETUSERCLASS" -> {
                                toClient.print(ResponseTemplates.genericJSON("{\"class\":\"" + credentialManager.getUserClass(username) + "\"}"));
                                toClient.flush();
                                continue;
                            }

                            case "GETALLUSERS" -> {
                                if(credentialManager.getUserClass(username).ordinal() < CredentialManager.USER_CLASS.ADMINISTRATOR.ordinal()){
                                    toClient.print(ResponseTemplates.FORBIDDEN);
                                } else {
                                    toClient.print(ResponseTemplates.genericJSON(credentialManager.getCredentialSetsAsJSON()));
                                }
                                toClient.flush();
                                continue;
                            }

                            case "SETUSERCLASS" -> {
                                // In this case, the line after the command is the username of the user to change,
                                // and the line after that is the new class. Users cannot promote anybody to a class
                                // higher than they are, and users cannot set the class of anybody with a higher
                                // permission level than them.
                                if(credentialManager.getUserClass(username).ordinal() < CredentialManager.USER_CLASS.ADMINISTRATOR.ordinal()){
                                    toClient.print(ResponseTemplates.FORBIDDEN);
                                } else if(lines.length < 3){
                                    toClient.print(ResponseTemplates.BADREQ);
                                } else if(credentialManager.getUserClass(username).ordinal() < CredentialManager.USER_CLASS.valueOf(lines[2]).ordinal()){
                                    toClient.print(ResponseTemplates.FORBIDDEN);
                                } else if(credentialManager.getUserClass(username).ordinal() < credentialManager.getUserClass(lines[1]).ordinal()){
                                    toClient.print(ResponseTemplates.FORBIDDEN);
                                } else {
                                    credentialManager.setUserClass(lines[1], CredentialManager.USER_CLASS.valueOf(lines[2]));
                                    toClient.print(ResponseTemplates.LOGOUT);
                                }
                                toClient.flush();
                                continue;
                            }

                            case "NEWUSER" -> {
                                // This has a ton of arguments! First line is the username, second is the password (TODO is that secure?).
                                // The class is set later.
                                if(credentialManager.getUserClass(username).ordinal() < CredentialManager.USER_CLASS.ADMINISTRATOR.ordinal()){
                                    toClient.print(ResponseTemplates.FORBIDDEN);
                                } else if((lines.length < 3) || (credentialManager.getUserClass(lines[1]) != null)){
                                    toClient.print(ResponseTemplates.BADREQ);
                                } else {
                                    Logging.logInfo("[Client Events] User \""+username+"\" added a new user, with name \""+lines[1]+"\".");
                                    credentialManager.addCredentialSet(lines[1], lines[2]);
                                    toClient.print(ResponseTemplates.LOGOUT);
                                }
                                toClient.flush();
                                continue;
                            }

                            case "DELETEUSER" -> {
                                // Just a username for this one, albeit with a guard to stop users from self-destructing.
                                // Additionally, there's a guard to prevent users from deleting higher classed-users.
                                if(credentialManager.getUserClass(username).ordinal() < CredentialManager.USER_CLASS.ADMINISTRATOR.ordinal()){
                                    toClient.print(ResponseTemplates.FORBIDDEN);
                                } else if(lines.length < 2 || lines[1].equals(username)){
                                    toClient.print(ResponseTemplates.BADREQ);
                                } else if(credentialManager.getUserClass(username).ordinal() < credentialManager.getUserClass(lines[1]).ordinal()){
                                    toClient.print(ResponseTemplates.FORBIDDEN);
                                } else {
                                    Logging.logInfo("[Client Events] User \""+username+"\" deleted a user, with name \""+lines[1]+"\".");
                                    credentialManager.removeCredentialSet(lines[1]);
                                    toClient.print(ResponseTemplates.LOGOUT);
                                }
                                toClient.flush();
                                continue;
                            }

                            case "GETCONTAINERS" -> {
                                // Assemble some ad-hoc json to send the server.
                                StringBuilder json = new StringBuilder();
                                json.append("{\"containers\":[");
                                String[][] containers = LXDUtils.getLXDInstances();
                                if(containers == null){
                                    toClient.print(ResponseTemplates.INTERR);
                                    toClient.flush();
                                    continue;
                                }
                                for(String[] container : containers){
                                    // Get status if the container state is RUNNING.
                                    String containerState = "";
                                    if(container[1].equals("RUNNING")){
                                        String defer = LXDUtils.getActiveState(container[0], container[0]);
                                        if(defer != null) containerState = defer;
                                    }

                                    String[] portListArr = LXDUtils.getOpenPorts(container[0]);
                                    String portList;
                                    if(portListArr == null){
                                        portList = "null";
                                    } else {
                                        portList = Format.formatPortList(portListArr);
                                    }

                                    json.append(String.format("{\"name\":\"%s\",\"state\":\"%s\",\"status\":\"%s\",\"ports\":%s},", container[0], container[1], containerState, portList));
                                }

                                json.deleteCharAt(json.length()-1).append("]}");

                                toClient.print(ResponseTemplates.genericJSON(json.toString()));
                                toClient.flush();
                                continue;
                            }

                            case "STARTSERVICE" -> {
                                // Admin only
                                if(credentialManager.getUserClass(username).ordinal() < CredentialManager.USER_CLASS.ADMINISTRATOR.ordinal()){
                                    toClient.print(ResponseTemplates.FORBIDDEN);
                                } else if(lines.length < 2) {
                                    toClient.print(ResponseTemplates.BADREQ);
                                } else {
                                    // Get container state, and make sure that 1. the container exists, 2. the container is RUNNING, and 3. the service isn't already active.
                                    String[][] containers = LXDUtils.getLXDInstances();
                                    if(containers == null){
                                        toClient.print(ResponseTemplates.INTERR);
                                        toClient.flush();
                                        continue;
                                    }
                                    boolean found = false;
                                    for(String[] container : containers){
                                        if(container[0].equals(lines[1])){

                                            String activeState = LXDUtils.getActiveState(container[0], container[0]);
                                            if(activeState == null){
                                                toClient.print(ResponseTemplates.INTERR);
                                                toClient.flush();
                                                continue;
                                            }

                                            if(container[1].equals("RUNNING") && !activeState.split(" ")[0].equals("active")){
                                                if(LXDUtils.startService(container[0], container[0])){
                                                    toClient.print(ResponseTemplates.LOGOUT);
                                                } else {
                                                    toClient.print(ResponseTemplates.INTERR);
                                                }
                                            } else {
                                                toClient.print(ResponseTemplates.BADREQ);
                                            }
                                            found = true;
                                            break;
                                        }
                                    }
                                    if(!found) toClient.print(ResponseTemplates.BADREQ);
                                }
                                toClient.flush();
                                continue;
                            }

                            case "STOPSERVICE" -> {
                                // Admin only
                                if(credentialManager.getUserClass(username).ordinal() < CredentialManager.USER_CLASS.ADMINISTRATOR.ordinal()){
                                    toClient.print(ResponseTemplates.FORBIDDEN);
                                } else if(lines.length < 2) {
                                    toClient.print(ResponseTemplates.BADREQ);
                                } else {
                                    // Get container state, and make sure that 1. the container exists, 2. the container is RUNNING, and 3. the service isn't already active.
                                    String[][] containers = LXDUtils.getLXDInstances();
                                    if(containers == null){
                                        toClient.print(ResponseTemplates.INTERR);
                                        toClient.flush();
                                        continue;
                                    }
                                    boolean found = false;
                                    for(String[] container : containers){
                                        if(container[0].equals(lines[1])){

                                            String activeState = LXDUtils.getActiveState(container[0], container[0]);
                                            if(activeState == null){
                                                toClient.print(ResponseTemplates.INTERR);
                                                toClient.flush();
                                                continue;
                                            }

                                            if(container[1].equals("RUNNING") && !activeState.split(" ")[0].equals("inactive")){
                                                if(LXDUtils.stopService(container[0], container[0])){
                                                    toClient.print(ResponseTemplates.LOGOUT);
                                                } else {
                                                    toClient.print(ResponseTemplates.INTERR);
                                                }
                                            } else {
                                                toClient.print(ResponseTemplates.BADREQ);
                                            }
                                            found = true;
                                            break;
                                        }
                                    }
                                    if(!found) toClient.print(ResponseTemplates.BADREQ);
                                }
                                toClient.flush();
                                continue;
                            }
                        }
                    } else {
                        Logging.logInfo(String.format("POST received, but with Content-Type: \"%s\". Returning 400.", headers.get("content-type")));
                    }
                }

                // TODO DELETE and PUT requests.

                // Still running? It's a bad request.
                Logging.logInfo(String.format("%s received, returning 400.", req.get(0).split(" ")[0]));
                toClient.print(ResponseTemplates.BADREQ);
                toClient.flush();
            }
        } catch (IOException | NullPointerException e){
            // Ignored
        }
    }

    // Terminates client connection via closing the socket. This should boot the thread out of it's while(true) loop since
    // the socket will throw an IOException.
    public void kill(){
        try {
            this.client.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private void authenticate(String content){
        // TODO check https://xkcd.com/327/

        // We should have a chunk of JSON in content. We'll process it assuming nothing is wrong, and then deal with
        // the copious amount of potential exceptions by sending 401 if it's invalid.
        String username, password;

        // TODO optimal default lifetime of token?
        try {
            // Username and password should both be strings following their respective tags.
            Pattern pattern = Pattern.compile("[^{}\"\\t:,]+");
            Matcher matcher = pattern.matcher(content);

            // First match should be "username", if not throw an IllegalArgumentException to run the 401.
            if(!matcher.find()){
                throw new IllegalArgumentException();
            }
            if(!matcher.group().equals("username")){
                throw new IllegalArgumentException();
            }
            // Next one is the username.
            if(!matcher.find()){
                throw new IllegalArgumentException();
            }
            username = matcher.group();
            // Next one should be "password"
            if(!matcher.find()){
                throw new IllegalArgumentException();
            }
            if(!matcher.group().equals("password")){
                throw new IllegalArgumentException();
            }
            // Next one is the password.
            if(!matcher.find()){
                throw new IllegalArgumentException();
            }
            password = matcher.group();

            // Now that we have those two, retrieve the salt for this user's hash, hash the given password and check it.
            // Or just call a method that does it all for me, so I can de-bloat this class.
            if(credentialManager.checkDetails(username, password)){
                // Generate bearer token and send it back to the client. Update the client's 'lastLogin' value.
                credentialManager.setUserLastLogin(username, System.currentTimeMillis()/1000);
                String resp = credentialManager.createBearerToken(username);
                toClient.print(ResponseTemplates.ValidAuthRequest(resp));
                toClient.flush();
            } else {
                // Send 401
                toClient.print(ResponseTemplates.UNAUTH);
                toClient.flush();
            }


        } catch (NullPointerException | IllegalArgumentException e){
            // Send 401
            toClient.print(ResponseTemplates.UNAUTH);
            toClient.flush();
        }
    }
}
