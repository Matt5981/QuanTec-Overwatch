#include <string.h>
#include <stdbool.h>
#include <stdlib.h>

#define IS_EQUAL(stringOne, stringTwo) strncmp(stringOne, stringTwo, strlen(stringOne)) == 0

const char* cmd_strings[] = {"start", "stop", "status", "list", "listprofdev", NULL};

bool char_in_array(const char* cmp, const char search){
	for(size_t i = 0; cmp[i] != '\0'; i++){
		if(cmp[i] == search){
			return true;
		}
	}
	return false;
}

bool string_in_array(const char* search, const char *list[]){
	// TODO check use of strlen here
	for(size_t i = 0; list[i] != NULL; i++){
		// Check if strlen is the same. If not, don't continue, else use strncmp to check equality. if that is zero, return true, else continue.
		if(strlen(search) == strlen(list[i])){
			if(strncmp(search, list[i], strlen(list[i])) == 0){
				return true;
			}
		}
	}
	return false;
}

bool contains_invalid_chars(const char* arg, const char* accepted_chars){
	for(size_t i = 0; arg[i] != '\0'; i++){
		if(!(char_in_array(accepted_chars, arg[i])) && !(48 <= arg[i] && arg[i] <= 57) && !(65 <= arg[i] && arg[i] <= 90) && !(97 <= arg[i] && arg[i] <= 122)){
			return true;
		}
	}
	return false;
}

int main(int argc, char **argv){
	// Wrapper to allow an unprivileged app to execute systemctl commands inside LXD containers. This only allows for the following actions:
	// 	Listing containers as output by "lxc list",
	// 	Listing the full device information of devices attached to containers by "lxc profile device show",
	// 	Executing a 'systemctl start' command inside a container,
	// 	Executing a 'systemctl stop' command inside a container, and
	// 	Executing a 'systemctl status' command inside a container.
	//
	// This executable should be run as a user in the LXD group via an unprivileged user using sudo.
	if(argc < 4){
		return 1;
	}

	// Restrict the type of systemctl commands that can be run to 'start', 'stop', 'status' and 'list' (the later isn't systemctl).
	if(!string_in_array(argv[2], cmd_strings)){
		return 1;
	}

	// If argv[2] was "list", run 'lxc list -f csv'
	if(IS_EQUAL(argv[2], "list")){
		return system("lxc ls -f csv");
	}

	// If argv[2] was "listprofdev", run 'lxc profile device show {argv[1]}-proxy'.
	if(IS_EQUAL(argv[2], "listprofdev")){
		char buf[4096];
		buf[0] = '\0';
		strlcat(buf, "lxc profile device show ", 4096);
		strlcat(buf, argv[1], 4096);
		strlcat(buf, "-proxy", 4096);

		return system(buf);
	}
	
	// Sanity check for the instance name, must be alphanumeric chars only with hypens permitted.
	if(contains_invalid_chars(argv[1], "-")){
		return 1;
	}

	// Sanity check for the service name, must be alphanumeric chars only with hypens and periods permitted.	
	if(contains_invalid_chars(argv[3], "-.")){
		return 1;
	}

	if(strlen(argv[3]) < 9){
		return 1;
	}

	// Both validated, feed into system().
	
	// Given the intended user of this program is the JVM, the extra 4KB of RAM usage here shouldn't impact the host system.
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
