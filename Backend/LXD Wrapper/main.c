#include <string.h>
#include <stdlib.h>

#define IS_EQUAL(stringOne, stringTwo) strncmp(stringOne, stringTwo, strlen(stringOne)) == 0

int main(int argc, char **argv){
	// Wrapper to allow an unprivileged app to execute systemctl commands inside LXD containers. This only allows for the following actions:
	// 	Executing a 'systemctl start' command inside a container,
	// 	Executing a 'systemctl stop' command inside a container, and
	// 	Executing a 'systemctl status' command inside a container.
	//
	// 	This executable should be compiled as a user in the LXD group, then have the SUID bit set.
	if(argc < 4){
		return 1;
	}

	// Restrict the type of systemctl commands that can be run to 'start', 'stop', 'status' and 'list' (the later isn't systemctl).
	if(!(IS_EQUAL(argv[2], "start") || IS_EQUAL(argv[2], "stop") || IS_EQUAL(argv[2], "status") || IS_EQUAL(argv[2], "list"))){
		return 1;
	}

	// If argv[2] was "list", run 'lxc list -f csv'
	if(IS_EQUAL(argv[2], "list")){
		return system("lxc ls -f csv");
	}

	// Else check the instance name. If it contains anything that isn't either an ASCII letter/number or a hyphen return 1.
	for(size_t i = 0; i < strlen(argv[1]); i++){
		if(!(argv[1][i] == 45) && !(48 <= argv[1][i] && argv[1][i] <= 57) && !(65 <= argv[1][i] && argv[1][i] <= 90) && !(97 <= argv[1][i] && argv[1][i] <= 122)){
			return 1;
		}
	}

	// Check the service name. It must not contain an @ symbol, since this may allow arbitrary arguments to be passed to systemd services.
	// It also must end in .service to prevent .sockets from being started.
	
	// No spaces are permitted, and these are subject to the same alphanumeric/hyphen restrictions as the instance name, with the additional permission of a period
	// to allow for '.service'.
	for(size_t i = 0; i < strlen(argv[3]); i++){
		if(!(argv[3][i] == 46) && !(argv[3][i] == 45) && !(48 <= argv[3][i] && argv[3][i] <= 57) && !(65 <= argv[3][i] && argv[3][i] <= 90) && !(97 <= argv[3][i] && argv[3][i] <= 122)){
			return 1;
		}
	}

	if(strlen(argv[3]) < 9){
		return 1;
	}

	// Both validated, feed into system().
	
	// Waste of 4KB :D
	// Given the intended user of this program is the bloated whale carcass that is the JVM in comparison, I don't think an extra 4kB of RAM usage will matter all that much.
	char buf[4096];
	buf[0] = '\0';
	
	strlcat(buf, "lxc exec ", 4096);
	strlcat(buf, argv[1], 4096);
	strlcat(buf, " -- systemctl ", 4096);
	strlcat(buf, argv[2], 4096);
	strlcat(buf, " ", 4096);
	strlcat(buf, argv[3], 4096);

	return system(buf);
}
