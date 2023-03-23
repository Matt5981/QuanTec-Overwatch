package org.matt598.quantecoverwatch.commands;

import org.matt598.quantecoverwatch.utils.Logging;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;

public class LXDUtils {
    private static final String LIST_CMD = "sudo -u lxdinteg /home/lxdinteg/lxdwrap foo list bar.service";
    private static final String[] ACCEPTABLE_METHODS = {"status", "start", "stop", "listprofdev"};
    private static String assembleStatusCMD(String containerName, String method, String serviceName){

        List<String> validMethods = new ArrayList<>();
        Collections.addAll(validMethods, ACCEPTABLE_METHODS);
        if(!validMethods.contains(method)){
            throw new IllegalArgumentException("Illegal method provided. Expected one of \"status\", \"start\", or \"stop\", got \""+method+"\".");
        }

        // Char check, since this runs a dangerous command, and I'm too lazy to roll back the containers.
        for(int i = 0; i < containerName.length(); i++){
            char subj = containerName.charAt(i);
            if(!((subj == 45) || (48 <= subj && subj <= 57) || (65 <= subj && subj <= 90) || (97 <= subj && subj <= 122))){
                throw new IllegalArgumentException(String.format("Illegal character provided in container name (0x%02X -> '%c')", (byte)subj, subj));
            }
        }
        for(int i = 0; i < serviceName.length(); i++){
            char subj = serviceName.charAt(i);
            if(!((subj == 45) || (subj == 46) || (48 <= subj && subj <= 57) || (65 <= subj && subj <= 90) || (97 <= subj && subj <= 122))){
                throw new IllegalArgumentException(String.format("Illegal character provided in service name (0x%02X -> '%c')", (byte)subj, subj));
            }
        }

        // Now that we're sane, return command string.
        return "sudo -u lxdinteg /home/lxdinteg/lxdwrap "+containerName+" "+method+" "+serviceName+".service";
    }

    /** <h2>Get LXD Instances</h2>
     * Gets a list of LXD containers running on the system.
     * @return A 2D array of strings, each <code>String[]</code> corresponding to one container. each <code>String[]</code> contains exactly two strings: The first is the container name, and the second is the state of the container (as returned by <code>lxc list</code>). Alternatively, <code>null</code> may be returned if executing the command throws an <code>IOException</code>, or if the value returned is invalid.
     */
    public static String[][] getLXDInstances(){
        // Run command, read result into buffer, split each line according to commas, ditch everything except the
        // first two strings on each line, join them again and return as a 2D array of strings.
        try {
            BufferedReader resp = new BufferedReader(new InputStreamReader(Runtime.getRuntime().exec(LIST_CMD).getInputStream()));
            List<String> returned = new ArrayList<>();
            String temp = resp.readLine();
            while(temp != null){
                returned.add(temp);
                temp = resp.readLine();
            }

            // Now we know how many lines to process.
            String[][] ret = new String[returned.size()][2];
            for (int i = 0; i < returned.size(); i++) {
                if(returned.get(i).split(",").length < 2){
                    return null;
                }
                ret[i][0] = returned.get(i).split(",")[0];
                ret[i][1] = returned.get(i).split(",")[1];
            }

            return ret;
        } catch (IOException e){
            return null;
        }
    }

    /** <h2>Get Active State</h2>
     * Gets the state of the specified systemd service inside the specified container.
     * @param containerName The name of the container. Values with non-alphanumeric characters (excluding hyphens) will cause this function to return <code>null</code>.
     * @param serviceName The name of the service. Has the same restrictions as above, albeit with periods also excepted.
     * @return A string detailing the activity state of the container (the text following <code>Active: </code> as is detailed by <code>systemctl status</code>.
     */
    public static String getActiveState(String containerName, String serviceName){
        try {
            BufferedReader resp = new BufferedReader(new InputStreamReader(Runtime.getRuntime().exec(assembleStatusCMD(containerName, "status", serviceName)).getInputStream()));
            List<String> returned = new ArrayList<>();
            String temp = resp.readLine();
            while(temp != null){
                returned.add(temp);
                temp = resp.readLine();
            }

            // This one's pretty similar to the list command. The difference here is that instead of having to churn
            // each line, we just have to find a particular one that starts with 5 spaces, followed by the exact word 'Active:',
            // followed by another space.
            for(String line : returned){
                if(line.startsWith("     Active: ")){
                    // Remove the 5 space prefix from the string, split it by spaces, then return a combination of the
                    // strings at indexes 1 and 2.
                    return line.substring(5).split(" ")[1] + " " + line.substring(5).split(" ")[2];
                }
            }
            return null;
        } catch (IOException | IllegalArgumentException | NullPointerException | ArrayIndexOutOfBoundsException e){
            return null;
        }
    }

    public static String[] getOpenPorts(String containerName){
        // Get open ports. LXD returns a bunch of crap, so we'll need to essentially look for the third integer after splitting a line
        // beginning with "  listen" by colons, then removing duplicates. We'll also prepend whether they're UDP or TCP, for the record.

        // First, issue the command:
        try {
            BufferedReader resp = new BufferedReader(new InputStreamReader(Runtime.getRuntime().exec(assembleStatusCMD(containerName, "listprofdev", containerName+".service")).getInputStream()));
            List<String> returned = new ArrayList<>();
            String temp = resp.readLine();
            while(temp != null){
                returned.add(temp);
                temp = resp.readLine();
            }

            // This one's pretty similar to the list command. The difference here is that instead of having to churn
            // each line, we just have to find a particular one that starts with 5 spaces, followed by the exact word 'Active:',
            // followed by another space.

            // We also need to make sure that we DON'T list any ports that are set to bind to the container, since not only are
            // those reverse ports, but they're dangerous to expose should somebody get RCE on the container.
            if(returned.size() == 0){
                throw new IllegalStateException("Invocation of wrapper returned nothing, likely crashed.");
            }

            List<String> fmt = new ArrayList<>();
            for(int i = 0; i < returned.size(); i++){
                if(returned.get(i).startsWith("  listen: ")){
                    if(!returned.get(i-2).equals("  bind: container")){
                        fmt.add(returned.get(i).substring(10).split(":")[2]+"/"+returned.get(i).substring(10).split(":")[0]);
                    }
                }
            }

            // Cheeky O(n) duplicate removal :D
            HashMap<String, Boolean> duplicate = new HashMap<>();
            for(String str : fmt){
                if(duplicate.get(str) == null){
                    duplicate.put(str, true);
                } else {
                    fmt.remove(str);
                }
            }

            return fmt.toArray(new String[0]);
        } catch (IOException | IllegalArgumentException | NullPointerException | ArrayIndexOutOfBoundsException e){
            return null;
        }
    }

    // Start and stop are even easier, since we don't wait for them to return and simply run. We will however set a timeout,
    // as stopping certain servers has been known to take ages (COUGH COUGH COUGH *That dinosaur game* COUGH COUGH COUGH).

    /** <h2>Start Service</h2>
     * Starts the specified systemd service unit inside the specified container. This will wait for exactly 2 minutes
     * before exiting, so if it takes too long to start, it may not start at all. This wait action occurs in a thread,
     * and is not monitored.
     * @param containerName The name of the container in which the service will be started.
     * @param serviceName The name of the service unit to start.
     * @return <code>true</code> if the command was successfully dispatched, <code>false</code> otherwise. Note that successful dispatch does <b>not</b> imply that the service started successfully.
     */
    public static boolean startService(String containerName, String serviceName){
        try {
            String cmd = assembleStatusCMD(containerName, "start", serviceName);


            Thread thread = new Thread(() -> {
                try {
                    Process proc = Runtime.getRuntime().exec(cmd);
                    proc.onExit().thenRun(proc::notifyAll);
                    synchronized (proc) {
                        proc.wait(120000);
                    }
                } catch (IOException | InterruptedException e){
                    Logging.logError("[Service Start Thread] Exception thrown while waiting for service to start. Manual check of service inside containers is recommended.");
                }
            });

            thread.start();
            return true;
        } catch (IllegalArgumentException e){
            return false;
        }
    }

    /** <h2>Stop Service</h2>
     * Stop the specified systemd service unit inside the specified container. This will wait for exactly 2 minutes
     * before exiting, so if it takes too long to stop, it may not stop at all. This wait action occurs in a thread,
     * and is not monitored.
     * @param containerName The name of the container in which the service will be stopped.
     * @param serviceName The name of the service unit to stop.
     * @return <code>true</code> if the command was successfully dispatched, <code>false</code> otherwise. Note that successful dispatch does <b>not</b> imply that the service stopped successfully.
     */
    public static boolean stopService(String containerName, String serviceName){
        try {
            String cmd = assembleStatusCMD(containerName, "stop", serviceName);

            Thread thread = new Thread(() -> {
                try {
                    Process proc = Runtime.getRuntime().exec(cmd);
                    proc.onExit().thenRun(proc::notifyAll);
                    synchronized (proc){
                        proc.wait(120000);
                    }
                } catch (IOException | InterruptedException e){
                    Logging.logError("[Service Start Thread] Exception thrown while waiting for service to stop. Manual check of service inside containers is recommended.");
                }
            });

            thread.start();
            return true;
        } catch (IllegalArgumentException e){
            return false;
        }
    }
}
