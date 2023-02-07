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
    private static final String VERSION = "v0.1 Beta";
    private static final int PORT = 8443;
    public static final String USER_CREDENTIAL_FILE = "quantec.secret";

    public static void main(String[] args) {
        System.out.println("\u001b[0;1mQuanTec Info Backend "+VERSION+". Programmed by Matt598, 2023.\u001b[0m");
        Logging.logInfo("[System] Starting...");

        Random random = new Random();
        // Keystore filename and password are the first and second arguments. We as such need to do some checks here.
        if(args.length < 2){
            Logging.logFatal("[System] Expected at least two arguments, got "+args.length+".");
            System.exit(1);
        }

        // final String KEYSTORE_FILENAME = args[0];
        // Charseq the second one.
        // final char[] KEYSTORE_PASSWORD = args[1].toCharArray();

        // Make credentials manager to handle authentication stuff for us.
        CredentialManager credentialManager = new CredentialManager(USER_CREDENTIAL_FILE, random);

        List<Client> clientList = new LinkedList<>();

        ScheduledExecutorService service = new ScheduledThreadPoolExecutor(1);
        service.scheduleAtFixedRate(new ClientReaper(clientList), 60, 60, TimeUnit.SECONDS);

        try(ServerSocket serverSocket = new ServerSocket(8443)) {

            // I DID NOT WRITE THIS CODE - adapted from https://stackoverflow.com/questions/53323855/sslserversocket-and-certificate-setup

//            KeyStore trustStore = KeyStore.getInstance(KeyStore.getDefaultType());
//            InputStream tstore = Main.class
//                    .getResourceAsStream("/keystore/" + KEYSTORE_FILENAME);
//            trustStore.load(tstore, KEYSTORE_PASSWORD);
//            if (tstore != null) {
//                tstore.close();
//            }
//            TrustManagerFactory tmf = TrustManagerFactory
//                    .getInstance(TrustManagerFactory.getDefaultAlgorithm());
//            tmf.init(trustStore);
//
//            KeyStore keyStore = KeyStore.getInstance(KeyStore.getDefaultType());
//            InputStream kstore = Main.class
//                    .getResourceAsStream("/keystore/" + KEYSTORE_FILENAME);
//            keyStore.load(kstore, KEYSTORE_PASSWORD);
//            KeyManagerFactory kmf = KeyManagerFactory
//                    .getInstance(KeyManagerFactory.getDefaultAlgorithm());
//            kmf.init(keyStore, KEYSTORE_PASSWORD);
//            SSLContext ctx = SSLContext.getInstance("TLS");
//            ctx.init(kmf.getKeyManagers(), tmf.getTrustManagers(),
//                    SecureRandom.getInstanceStrong());

            // END OF COPIED CODE

            // SSLServerSocket serverSocket = (SSLServerSocket) ctx.getServerSocketFactory().createServerSocket(PORT);

            // Restrict to TLS v1.3.
            //serverSocket.setEnabledProtocols(new String[]{"TLSv1.3"});
            //serverSocket.setNeedClientAuth(false);
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