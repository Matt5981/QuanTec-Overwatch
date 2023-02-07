package org.matt598.quantecoverwatch.utils;

import org.matt598.quantecoverwatch.clients.Client;

import java.util.Iterator;
import java.util.List;

// Removes dead clients from the client list to save memory.
public class ClientReaper extends Thread {
    private final List<Client> clientList;

    public ClientReaper(List<Client> clientList){
        this.clientList = clientList;
    }

    @Override
    public void run(){
        // Step through client list and remove any that are dead (meaning the socket's closed).
        // This uses the list's iterator to stop it from skipping over objects when the list shrinks on removal.
        // Code credit: https://stackoverflow.com/questions/1921104/loop-on-list-with-remove

        int tally = 0;
        for (Iterator<Client> iter = clientList.iterator(); iter.hasNext();) {
            Client next = iter.next();
            if(!next.isAlive()){
                iter.remove();
                tally++;
            }
        }

        if(tally != 0){
            Logging.logInfo("[Client Reaper] Removed " + tally + " dead client(s) from the client list.");
        }
    }
}
