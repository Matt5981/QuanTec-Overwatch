package org.matt598.quantecoverwatch;

import org.matt598.quantecoverwatch.clients.Client;
import org.matt598.quantecoverwatch.credentials.CredentialManager;
import org.matt598.quantecoverwatch.utils.ClientReaper;
import org.matt598.quantecoverwatch.utils.Logging;

// import javax.net.ssl.*;
import java.io.IOException;
// import java.io.InputStream;
import java.net.ServerSocket;
import java.net.SocketException;
// import java.security.KeyStore;
// import java.security.SecureRandom;
import java.util.LinkedList;
import java.util.List;
import java.util.Random;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

// TODO chunked encoding support is mandatory for HTTP/1.1 compliance
// TODO DELETE and PUT methods are required for RESTful compliance

public class Main {
    private static final String VERSION = "v0.2 Beta";
    private static final int PORT = 8443;
    public static final String USER_CREDENTIAL_FILE = "quantec.secret";

    public static void main(String[] args) {
        System.out.println("\u001b[0;1mQuanTec Info Backend "+VERSION+". Programmed by Matt598, 2023.\u001b[0m");
        Logging.logInfo("[System] Starting...");

        // First (and only) argument should be the Discord OAuth token. If not provided, we'll automatically return 500 for
        // OAuth requests via Discord.
        String discordOAuthSecret = null, discordOAuthPublic = null, discordOverrideServer = null;
        if(args.length > 1){
            discordOAuthPublic = args[0];
            discordOAuthSecret = args[1];
        } else {
            Logging.logError("[System] Discord OAuth client id/secret not provided. Signing in with Discord will be disabled until the server is restarted and provided with this.");
        }

        if(args.length > 2){
            discordOverrideServer = args[2];
            Logging.logWarning("[System] Override server provided. Any member of the provided server is able to log into the webapp. PUBLIC ACCESS IS ENABLED.");
        }

        Random random = new Random();

        // Make credentials manager to handle authentication stuff for us.
        CredentialManager credentialManager = new CredentialManager(USER_CREDENTIAL_FILE, random, discordOAuthPublic, discordOAuthSecret, discordOverrideServer);

        List<Client> clientList = new LinkedList<>();

        ScheduledExecutorService service = new ScheduledThreadPoolExecutor(1);
        service.scheduleAtFixedRate(new ClientReaper(clientList), 60, 60, TimeUnit.SECONDS);

        try(ServerSocket serverSocket = new ServerSocket(8443)) {
            // Accept new connections on loop. Client requests are handled in threads. TODO report thread usage on app itself.
            Logging.logInfo(String.format("[System] Started, listening on %d/tcp.", PORT));
            while(true){
                clientList.add(new Client(serverSocket.accept(), credentialManager));
            }
        } catch (SocketException e){
            Logging.logInfo("SocketException thrown, assuming shutdown requested.");
        } catch (IOException e){
            System.err.println("IOException thrown while setting server up.");
            e.printStackTrace();
        } catch (Exception e){
            e.printStackTrace();
        }

        service.shutdown();

        if(clientList.size() != 0) {
            Logging.logInfo(String.format("Shutting down, killing connections of %d clients.", clientList.size()));

            for (Client client : clientList) {
                client.kill();
            }
        }
    }
}