package org.matt598.quantecoverwatch.commands;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class UsageStats {

    private abstract static class MountPoints {
        public static final String BOOT = "/";
        public static final String STORAGE = "/mnt/archive/";
        public static final String LXD = "/var/lib/lxd/storage-pools/default"; // TODO verify
    }

    private static String assembleTemplate(long uptime, long bootstorageused, long bootstoragetotal,
                                           long storagestorageused, long storagestoragetotal, long lxdstorageused,
                                           long lxdstoragetotal){
        return String.format("{" +
                "\"uptime\":%d," +
                "\"storage\":{" +
                    "\"bootused\": \"%d\"," +
                    "\"boottotal\": \"%d\"," +
                    "\"storageused\":\"%d\"," +
                    "\"storagetotal\":\"%d\"," +
                    "\"lxdused\":\"%d\"," +
                    "\"lxdtotal\":\"%d\"" +
                "}" +
            "}", uptime, bootstorageused, bootstoragetotal, storagestorageused, storagestoragetotal, lxdstorageused, lxdstoragetotal);
    }

    private static long getUptime() throws IOException {
        // Get environment. Linux has /proc/uptime, macOS forces the use of a sysctl command.

        if(System.getProperty("os.name").equals("Mac OS X")){
            String resp = new BufferedReader(new InputStreamReader(Runtime.getRuntime().exec("/usr/sbin/sysctl -n kern.boottime").getInputStream())).readLine();

            // Returns a string similar to JSON. We want the first integer, which we can grab with some light regex.
            Matcher matcher = Pattern.compile("[0-9]\\w+").matcher(resp);
            if(!matcher.find()) {
                return -1;
            }

            // System.out.println("Uptime was "+matcher.group());
            return (System.currentTimeMillis() / 1000) - Long.parseLong(matcher.group());
        } else {
            // Assume we're running on Linux. In this case, it's the first number too, but we actually get the uptime,
            // not the kernel boot time.
            String resp = new BufferedReader(new InputStreamReader(Runtime.getRuntime().exec("cat /proc/uptime").getInputStream())).readLine();
            Matcher matcher = Pattern.compile("[0-9]\\w+").matcher(resp);
            if(!matcher.find()) {
                return -1;
            }

            return Long.parseLong(matcher.group());
        }
    }

    private static long[] getDriveStorage(String mountpoint){
        // Get using the File class.
        File file = new File(mountpoint);
        return new long[]{file.getFreeSpace(), file.getTotalSpace()};
    }

    public static String getUsageStats(){
        // Retrieve usage stats. Most of these come from console commands.

        // Uptime, which comes from a shell command.
        long uptime;

        try {
            uptime = getUptime();
        } catch (IOException e){
            uptime = -1;
        }

        return UsageStats.assembleTemplate(uptime, getDriveStorage(MountPoints.BOOT)[0], getDriveStorage(MountPoints.BOOT)[1], getDriveStorage(MountPoints.STORAGE)[0], getDriveStorage(MountPoints.STORAGE)[1], getDriveStorage(MountPoints.LXD)[0], getDriveStorage(MountPoints.LXD)[1]);
    }
}
