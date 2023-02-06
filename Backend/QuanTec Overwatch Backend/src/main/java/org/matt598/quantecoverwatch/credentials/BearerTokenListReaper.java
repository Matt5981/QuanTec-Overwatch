package org.matt598.quantecoverwatch.credentials;

import java.util.List;

public class BearerTokenListReaper implements Runnable {
    private final List<BearerToken> tokenList;

    public BearerTokenListReaper(List<BearerToken> tokenList){
        this.tokenList = tokenList;
    }

    @Override
    public void run(){
        // Invalid, remove from list. Turns out there's a method for making this a one-liner. That collections
        // interface really is something.
        tokenList.removeIf(next -> (System.currentTimeMillis() / 1000) >= (next.created + next.lifetime));
    }
}
