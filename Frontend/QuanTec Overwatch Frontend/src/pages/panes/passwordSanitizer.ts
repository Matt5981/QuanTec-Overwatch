export const sanitizePassword = function(password: string){
    const mappings = {
        '"': '%22',
        ',': '%2C',
        ':': '%3A',
        '{': '%7B',
        '}': '%7D'
    }

    var out = password;

    for(var char in Object.keys(mappings)){
        out.replace(new RegExp(char, 'g'), mappings[char]);
    }

    return out;
}