package org.matt598.quantecoverwatch.utils;

import java.text.SimpleDateFormat;
import java.util.Date;

public class Logging {

    private static final String ANSI_RESET = "\u001B[0m";
    private static final String ANSI_RED = "\u001B[31m";
    private static final String ANSI_YELLOW = "\u001B[33m";

    private static String getTS(){
        return new SimpleDateFormat("yyyy/MM/dd @ hh:mm:ss").format(new Date());
    }

    public static String getDateHeader(){
        // Return the HTTP header with a datestamp on it. Useful for error codes.
        return "Date: " + new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss zzzz").format(new Date());
    }

    public static void logInfo(String text){
        System.out.printf("[%s] [INFO]    %s\n", getTS(), text);
    }

    public static void logWarning(String text){
        System.out.printf("%s[%s] [WARNING] %s%s\n", ANSI_YELLOW, getTS(), text, ANSI_RESET);
    }

    public static void logError(String text){
        System.out.printf("%s[%s] [ERROR]   %s%s\n", ANSI_RED, getTS(), text, ANSI_RESET);
    }

    public static void logFatal(String text){
        System.out.printf("%s[%s] [FATAL]   %s%s\n", ANSI_RED, getTS(), text, ANSI_RESET);
    }
}
