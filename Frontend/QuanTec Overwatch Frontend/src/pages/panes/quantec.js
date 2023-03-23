import React from 'react';
import { SERVER_IP } from './masterAPIAddress';
import './quantec.css';
import { USER_CLASSES } from './UserClassHeirarchy';

class Quantec extends React.Component {

    constructor(props){
        super(props);

        this.state = {
            analytics: undefined,
            lastAnalyticsFetchTimestamp: undefined,
            serverData: {},
            emoteData: {},
            emoteLeaderboardActiveServer: undefined,
            activeDropdown: '',
            interval: undefined,
            manageServerGuilds: null,
            noManageServerReason: 'loading',
            banData: {
                words: {},
                images: {},
                imagePcnt: {},
                guilds: {}
            },
            wordActive: undefined,
            imageActive: undefined,
            activeDialog: '',
            formData: {},
            submitDisabled: true
        };

        // Try to fetch analytics from the backend.
        this.updateData();
        this.activeClicked = this.activeClicked.bind(this);
        this.inactiveClicked = this.inactiveClicked.bind(this);
        this.bannedWordDeletePressed = this.bannedWordDeletePressed.bind(this);
        this.bannedImageDeletePressed = this.bannedImageDeletePressed.bind(this);
        this.downloadBannedImage = this.downloadBannedImage.bind(this);
        this.launchDialog = this.launchDialog.bind(this);
        this.onDialogCancel = this.onDialogCancel.bind(this);
        this.onDialogFormChange = this.onDialogFormChange.bind(this);
        this.onDialogFormSubmit = this.onDialogFormSubmit.bind(this);
        this.onBanImageFormSubmit = this.onBanImageFormSubmit.bind(this);
    }

    componentDidMount(){
        this.setState({
            interval: setInterval(() => this.updateData(), 10000)
        });
    }

    componentWillUnmount(){
        clearInterval(this.state.interval);
    }

    updateData(){
        // Fetch new object from API.
        console.log("UPDATING...");
        fetch(new Request(SERVER_IP+'quantec/analytics', {method: 'GET', mode: 'cors', credentials: 'include'})).then(
            res => {
                if(res.status !== 200){
                    this.setState({
                        analytics: null,
                        lastAnalyticsFetchTimestamp: null
                    });
                } else {
                    return res.json();
                }
            }
        ).then(
            res => {
                
                var serverDataNew = {};
                var emoteDataNew = {};
                if(res.emoteSightings.guilds !== "null"){
                    
                    // If we have data, we need to get the details of each server in the emote leaderboard list so we can get their icons/names for later use.
                    Object.keys(res.emoteSightings.guilds).forEach( entry => {
                        fetch(new Request(SERVER_IP+'quantec/guilds/'+entry, {method: 'GET', mode: 'cors', credentials: 'include'})).then(
                            res => {return res.json();}
                        ).then(
                            res => {
                                // FIXME this is REALLY inefficient.

                                const newServerData = this.state.serverData;
                                newServerData[res.id] = {
                                    id: res.id,
                                    name: res.name,
                                    imageIconURL: res.iconURL
                                };

                                this.setState({
                                        serverData: newServerData,
                                        lastAnalyticsFetchTimestamp: new Date(),
                                        emoteLeaderboardActiveServer: this.state.emoteLeaderboardActiveServer === undefined ? {
                                            id: res.id,
                                            name: res.name,
                                            imageIconURL: res.iconURL
                                        } : this.state.emoteLeaderboardActiveServer
                                });
                            }
                        );
                    });

                    // We also need to get the names/images from all emotes that we caught.
                    var toProcess = [];
                    Object.values(res.emoteSightings.guilds).forEach( entry => {

                        Object.keys(entry).forEach(obj => {
                            if(!toProcess.includes(obj)){
                                toProcess.push(obj);
                            }
                        });
                    });

                    toProcess.forEach(emote => {
                        fetch(new Request(SERVER_IP+'quantec/emojis/'+emote, {method: 'GET', mode: 'cors', credentials: 'include'})).then(
                            res => {return res.json();}
                        ).then(
                            res => {

                                emoteDataNew = this.state.emoteData;

                                emoteDataNew[emote] = {
                                    id: res.id,
                                    name: res.name,
                                    imageIconURL: res.iconURL
                                }

                                this.setState({
                                    emoteData: emoteDataNew,
                                    lastAnalyticsFetchTimestamp: new Date()
                                });
                            }
                        );
                    });
                } else {
                    serverDataNew = null;
                    emoteDataNew = null;
                }

                const newState = this.state;

                
                newState.analytics = res;
                newState.lastAnalyticsFetchTimestamp = new Date();

                if(this.state.emoteLeaderboardActiveServer === undefined){
                    newState.serverData = serverDataNew;
                    newState.emoteData = emoteDataNew;
                }
                
                this.setState(newState);
            }
        );

        if(USER_CLASSES[window.localStorage.getItem('usrClass')] >= USER_CLASSES['ADMINISTRATOR']){
            if(localStorage.getItem('discordSnowflake') === null && window.localStorage.getItem('usrClass') !== 'SUPERUSER'){
                this.setState({
                    manageServerGuilds: null,
                    noManageServerReason: 'noDiscord'
                });
            } else {
                // Since we signed in with Discord, the backend server knows our snowflake. As such, we can request the list of servers we have MANAGE_SERVER on.
                fetch(new Request(SERVER_IP + (localStorage.getItem('usrClass') === 'SUPERUSER' ? 'quantec/guilds' : 'quantec/users/manageserver/'+localStorage.getItem('discordSnowflake')), {method: 'GET', mode: 'cors', credentials: 'include'})).then(
                    res => { return res.json(); }
                ).then(res => {
                    // If we have no entries in 'guilds', add an error message, otherwise process the tables.
                    if(res.guilds.length === 0){
                        this.setState({
                            manageServerGuilds: null,
                            noManageServerReason: 'noManageServer'
                        });
                    } else {
                        this.setState({
                            manageServerGuilds: res.guilds,
                            noManageServerReason: null
                        }, () => {
                            if(this.state.manageServerGuilds == null){
                                console.log("ERROR");
                                return;
                            }
                            // once that goes through, we'll for-each each of the guilds specified in 'manageServerGuilds' to figure out their banned words and images.
                            this.state.manageServerGuilds.forEach(guild => {
                                // Words
                                fetch(new Request(SERVER_IP+'quantec/words/'+guild, {method: 'GET', mode: 'cors', credentials: 'include'})).then(
                                    res => { return res.json(); }
                                ).then(res => {
                                        // Add banned words to the internal object. TODO using the same inefficient selection method as the emote leaderboard!
                                        var newBanData = this.state.banData;
                                        newBanData.words[guild] = res.bannedWords;

                                        this.setState({
                                            banData: newBanData,
                                            wordActive: this.state.wordActive === undefined ? guild : this.state.wordActive
                                        });
                                });

                                // Images
                                fetch(new Request(SERVER_IP+'quantec/images/'+guild, {method: 'GET', mode: 'cors', credentials: 'include'})).then(
                                    res => { return res.json(); }
                                ).then(
                                    res => {
                                        // Add banned words to the internal object. TODO using the same inefficient selection method as the emote leaderboard! Try putting all of these fetches into a separate, async function so it can wait for
                                        // them to be fetched, use null checks to stop render() from throwing errors if it tries to draw while one of the fetches is still going.
                                        var newBanData = this.state.banData;
                                        newBanData.images[guild] = res.bannedImages;
                                        console.log("TOLERANCE: "+res.tolerance);
                                        newBanData.imagePcnt[guild] = res.tolerance;

                                        this.setState({
                                            banData: newBanData,
                                            imageActive: this.state.imageActive === undefined ? guild : this.state.imageActive
                                        });
                                });

                                // Guild Data
                                fetch(new Request(SERVER_IP+'quantec/guilds/'+guild, {method: 'GET', mode: 'cors', credentials: 'include'})).then(
                                    res => { return res.json(); }
                                ).then(
                                    res => {
                                        // Add banned words to the internal object.
                                        // them to be fetched, use null checks to stop render() from throwing errors if it tries to draw while one of the fetches is still going.
                                        var newBanData = this.state.banData;
                                        newBanData.guilds[guild] = res;

                                        this.setState({
                                            banData: newBanData
                                        });
                                });
                            });
                        });
                    }
                });
            }
        } else {
            this.setState({
                manageServerGuilds: null,
                noManageServerReason: null
            });
        }
    }

    activeClicked(event){
        this.setState({
            activeDropdown: event.target.id === this.state.activeDropdown ? '' : event.target.id
        });
    }

    inactiveClicked(event){
        // TODO unify how the 'active' variable works for all three dropdowns so this can be shrunk.
        var newState = this.state;

        switch(this.state.activeDropdown){
            case 'bannedWordSelect':
                newState = {
                    wordActive: event.target.id
                };
                break;

            case 'bannedImageSelect':
                newState = {
                    imageActive: event.target.id
                };
                break;

            default:
                const guild = this.state.serverData[event.target.id];
                newState = {
                    emoteLeaderboardActiveServer: {
                        id: guild.id,
                        name: guild.name,
                        imageIconURL: guild.imageIconURL
                    },
                };
        }

        newState['activeDropdown'] = '';
        this.setState(newState);
    }

    bannedWordDeletePressed(event){
        // Get the ID of the button that called it, strip the preface off it, pause the update interval,
        // send the unban query, call updateData manually, then start the interval again.
        var buttonID = event.target.id;
        if(buttonID.startsWith('bannedWord_')){
            buttonID = buttonID.substring(11);
        } else {
            return;
        }

        clearInterval(this.interval);

        fetch(new Request(SERVER_IP+'quantec/words/'+this.state.wordActive, {
            method: 'DELETE', 
            mode: 'cors', 
            credentials: 'include', 
            headers: {'content-type': 'application/json'}, 
            body: JSON.stringify({guild: this.wordActive, words: [buttonID]})})).then(
                res => {
                    if(res.status !== 204){
                        alert('Error occured while deleting banned word. ('+res.status+') THIS MESSAGE IS A PLACEHOLDER AND WILL BE REPLACED SHORTLY.');
                    }
                    this.updateData();

                    this.setState({
                        interval: setInterval(this.updateData, 10000)
                    });
                }
        )
    }

    bannedImageDeletePressed(event){
        var buttonID = event.target.id;
        if(buttonID.startsWith('bannedImage_')){
            buttonID = buttonID.substring(12);
        } else {
            return;
        }

        clearInterval(this.interval);

        fetch(new Request(SERVER_IP+'quantec/images/'+this.state.imageActive+'/'+buttonID, {method: 'DELETE', mode: 'cors', credentials: 'include'})).then(
                res => {
                    if(res.status !== 204){
                        alert('Error occured while deleting banned image. ('+res.status+') THIS MESSAGE IS A PLACEHOLDER AND WILL BE REPLACED SHORTLY.');
                    }
                    this.updateData();

                    this.setState({
                        interval: setInterval(this.updateData, 10000)
                    });
                }
        )
    }

    downloadBannedImage(event){
        // Here to stop weird lambda behaviour.
        const link = SERVER_IP+'quantec/images/'+this.state.imageActive+'/'+event.target.id;
        console.log('OPENING '+link);
        window.open(link);
    }

    launchDialog(event){
        console.log(event);
        // We prefer to use currentTarget, but we'll use the normal target field if it's null (for example, if it gets passed after some setup by setState)
        console.log("DIALOG LAUNCH '"+(event.currentTarget === null ? event.target.id : event.currentTarget.id)+"'");
        this.setState({
            activeDialog: event.currentTarget === null ? event.target.id : event.currentTarget.id
        });
    }

    onDialogCancel(){
        this.setState({
            activeDialog: '',
            formData: {},
            submitDisabled: true
        });
    }

    onDialogFormChange(event){
        var newFormData = this.state.formData;
        var newSubmitDisabled = this.state.submitDisabled;

        // Sanity check, any submit button needs to be disabled if the change was to a text input and the new value is blank.
        console.log('event.target.value: '+event.target.value);
        newSubmitDisabled = !(event.target.value !== undefined && event.target.value !== '');
        console.log('newSubmitDisabled: '+newSubmitDisabled+' conditions: '+(event.target.value !== undefined)+' && '+(event.target.value !== ''));
        newFormData[event.target.id] = (event.target.id === 'fileUpload' ? event.target.files[0] : event.target.value);

        // Per-form checks, since the above only covers the one-word ones like image tolerance and banned word submission.
        if(event.target.id === 'fileUpload'){
            // Ban image. If either of its fields are blank, disable the ban button.
            // Note that a separate check is not required for the name field, as if that's blank then
            // the first check will catch it, and the file upload input has its own latch.
            newSubmitDisabled = (event.target.value === undefined || event.target.value === '' || this.state.formData.nick === undefined || this.state.formData.nick === '');
            console.log('exempt newSubmitDisabled = '+newSubmitDisabled + 'form data nick is "'+this.state.formData.nick+'"');
        }

        // Extra sanity check for the ban image form, we need to make sure it's an image that
        // quantec will accept. This sanity check is repeated before we upload it.
        if(event.target.id === 'fileUpload'){
            if(!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(event.target.files[0].type)){
                newFormData.statusText = 'INVALID.';
                newFormData.uploadReady = false;
            } else {
                newFormData.statusText = 'OK!';
                newFormData.uploadReady = true;
            }
        }
        if(event.target.id === 'pcnt'){
            // Value must be an integer between 0 and 100 for the 'submit' button to unlock.
            newSubmitDisabled = (event.target.value != Math.floor(event.target.value) || event.target.value < 0 || event.target.value > 100 || event.target.value === '');
        }

        console.log('summary: newSubmitDisabled: '+newSubmitDisabled+' newFormData: ');
        console.log(newFormData);

        this.setState({
            formData: newFormData,
            submitDisabled: newSubmitDisabled
        });
    }

    onDialogFormSubmit(event){
        event.preventDefault();

        // Regardless of which form it is, it'll always send a request that returns 204 if successful, so most of this method is just
        // assembling the request.
        var req;

        switch(event.target.id){
            case 'newBannedWordForm':
                req = new Request(SERVER_IP+'quantec/words/'+this.state.wordActive, {method: 'PUT', mode: 'cors', credentials: 'include', headers: {'content-type': 'application/json'}, body: JSON.stringify({words: [this.state.formData.word]})});
                break;

            case 'editBannedImageForm':
                req = new Request(SERVER_IP+'quantec/images/'+this.state.imageActive+'/'+this.state.formData.subjOldName, {method: 'POST', mode: 'cors', credentials: 'include', headers: {'content-type': 'application/x-www-form-urlencoded'}, body: 'nickname='+this.state.formData.nick+'&adaptive='+this.state.formData.adaptive});
                break;

            case 'setToleranceForm':
                req = new Request(SERVER_IP+'quantec/images/tolerance/'+this.state.imageActive, {method: 'PUT', mode: 'cors', credentials: 'include', headers: {'content-type': 'application/x-www-form-urlencoded'}, body: 'tolerance='+this.state.formData.pcnt});
                break;
            
            default:
                // Unknown form, do nothing to be safe.
                return;
        }

        clearInterval(this.state.interval);
        fetch(req).then(res => {
            if(res.status !== 204){
                alert('Server returned an error. ('+res.status+') THIS MESSAGE IS A PLACEHOLDER AND WILL BE REPLACED SHORTLY.');
            } else {
                // Early data update
                this.updateData();
                this.setState({
                    interval: setInterval(this.updateData, 10000)
                }, () => this.onDialogCancel());
            }
        });
    }

    onBanImageFormSubmit(event){
        event.preventDefault();
        var newFormData = this.state.formData;
        newFormData['uploadReady'] = false;
        this.setState({
            formData: newFormData
        });

        clearInterval(this.state.interval);

        // This requires a separare function since the FileReader class is asynchronous.
        const reader = new FileReader();
        reader.readAsDataURL(this.state.formData.fileUpload);
        reader.onload = () => {
            var res = reader.result.substring(reader.result.indexOf(',')+1);
            fetch(new Request(SERVER_IP+'quantec/images/'+this.state.imageActive, {method: 'PUT', mode: 'cors', credentials: 'include', headers: {'content-type': 'application/json'}, body: JSON.stringify({nickname: this.state.formData.nick, content: res})})).then(
                res => {
                    if(res.status !== 204){
                        alert('Server returned an error. ('+res.status+') THIS MESSAGE IS A PLACEHOLDER AND WILL BE REPLACED SHORTLY.');
                    } else {
                        // Early data update
                        this.updateData();
                        this.setState({
                            interval: setInterval(this.updateData, 10000)
                        }, () => this.onDialogCancel());
                    }
                }
            );
        };
        reader.onerror = () => {
            alert('Formatting image for upload returned an error. THIS MESSAGE IS A PLACEHOLDER AND WILL BE REPLACED SHORTLY.');
            newFormData['uploadReady'] = true;
            this.setState({
                formData: newFormData
            });
        };
    }

    render() {

        if(!this.props.enabled){
            return;
        }

        // If analytics isn't undefined, format interval string.
        var passInterval = 'Loading...';
        if(this.state.analytics !== undefined){
            const interval = Math.floor(Date.now() / 1000) - this.state.analytics.lastPassAppearance;
            passInterval = (Math.floor(interval / 86400)) + ' days, '+(Math.floor((interval % 86400) / 3600))+' hours, '+(Math.floor(((interval % 86400) % 3600) / 60))+' minutes and '+(Math.floor(((interval % 86400) % 3600) % 60))+((Math.floor(((interval % 86400) % 3600) % 60)) === 1 ? ' second ago' : ' seconds ago');
        }


        // Format guild list if it isn't undefined. Since the select element doesn't allow images, we need to do some javascript butchery here.
        // First, make the element for the active object. This doesn't select when clicked, rather it triggers the dropdown to show.
        var active;
        var emoteTable;
        var emoteTableEntries = [];
        
        if(this.state.emoteLeaderboardActiveServer !== undefined && this.state.emoteLeaderboardActiveServer !== null) {
            active = <div className='quantecEmoteLeaderboardGuildSelectorActive' onClick={this.activeClicked} id='emoteLeaderboardSelect'><img src={this.state.emoteLeaderboardActiveServer.imageIconURL} className='quantecEmoteLeaderboardGuildSelectorImage' /><p>{this.state.emoteLeaderboardActiveServer.name}</p><hr /><p style={{marginRight: '10px'}}>{'\\/'}</p></div>;

            if(this.state.analytics.emoteSightings.guilds[this.state.emoteLeaderboardActiveServer.id] !== undefined){

                // Push them all into an array first so they can be sorted.
                const emoteTableCandidates = [];

                Object.keys(this.state.analytics.emoteSightings.guilds[this.state.emoteLeaderboardActiveServer.id]).forEach(ele => {
                    const emoteCandidate = this.state.emoteData[ele];
                    const appearancesCandidate = this.state.analytics.emoteSightings.guilds[this.state.emoteLeaderboardActiveServer.id][ele];
                    if(emoteCandidate !== undefined && appearancesCandidate !== undefined){
                        emoteTableCandidates.push({emote: emoteCandidate, appearances: appearancesCandidate});
                    }
                });

                emoteTableCandidates.sort((a, b) => a.appearances < b.appearances ? 1 : -1);

                emoteTableCandidates.forEach(ele => {
                    emoteTableEntries.push(<div className='quantecEmoteLeaderboardTableRow'><img src={ele.emote.imageIconURL} /><hr /><p>{ele.emote.name}</p><hr /><p>{ele.appearances}</p></div>);
                });

                emoteTable = <div className='quantecEmoteLeaderboard'>
                    <div className='quantecEmoteLeaderboardHead'>
                        <div className='quantecEmoteLeaderboardTableHeader'><p id='quantecEmoteLeaderboardEmoteLabel'>Emote</p><hr /><p>Name</p><hr /><p>Appearances</p></div>
                    </div>
                    <div className='quantecEmoteLeaderboardBody'>
                        {emoteTableEntries}
                    </div>
                </div>
            } else {
                emoteTable = <h2>// NO DATA</h2>;
            }

        } else {
            if(this.state.emoteData === null){
                emoteTable = <h2>// NO DATA</h2>;
            } else {
                active = <p>Loading...</p>;
            }
        }

        // Admin-only settings for the 'banned words' and 'banned images' panes.
        // Since these are admin only, we don't want to waste a fetch on something that will return 403 for the majority of users, so we'll do this in a large if block.
        var adminPanels = [];

        if(!(this.state.manageServerGuilds === null && this.state.noManageServerReason === null)){

            var wordTableActive;
            var wordTable;
            var wordTableEntries = [];
            var wordTableInactives = [];
            var imageTableActive;
            var imageTable;
            var imageTableEntries = [];
            var imageTableInactives = [];
            // We also need to get the list of servers that QuanTec is a part of where the user has MANAGE_SERVER, since it's those servers that allow access to the ban methods.
            // If the user has none, we'll null the above six, which will also stop the <div>s with the settings from showing up.
            if(this.state.manageServerGuilds === null){
                if(this.state.noManageServerReason === 'noDiscord'){
                    adminPanels.push(<div className='quantecContentContainer'><h2 className='quantecAdminErrorMessage'>To access administrator settings for QuanTec, you must sign in with Discord.</h2></div>);
                } else if(this.state.noManageServerReason === 'noManageServer'){
                    adminPanels.push(<div className='quantecContentContainer'><h2 className='quantecAdminErrorMessage'>You do not have the 'Manage Server' permission in any of QuanTec's servers, administrator settings are inaccessible.</h2></div>);
                } else {
                    adminPanels.push(<div className='quantecContentContainer'><h2 className='quantecAdminErrorMessage'>Loading...</h2></div>);
                }
            } else {
                // Words
                if(this.state.wordActive !== undefined && this.state.banData.guilds[this.state.wordActive] !== undefined){
                    // Set the wordTableActive variable first.
                    wordTableActive = <div className='quantecEmoteLeaderboardGuildSelectorActive' onClick={this.activeClicked} id='bannedWordSelect'><img src={this.state.banData.guilds[this.state.wordActive].iconURL} className='quantecEmoteLeaderboardGuildSelectorImage' /><p>{this.state.banData.guilds[this.state.wordActive].name}</p><hr /><p style={{marginRight: '10px'}}>{'\\/'}</p></div>;
                    
                    // Assemble the inactives. Luckily if a user has permission to modify banned words, they also have permission to modify banned images, so there's remarkably little work needed here.
                    Object.values(this.state.banData.guilds).forEach(guild => {
                        if(guild.id !== this.state.wordActive){
                            wordTableInactives.push(
                                <div className='quantecEmoteLeaderboardGuildSelectorInactive' onClick={this.inactiveClicked} id={guild.id}><img src={guild.iconURL} className='quantecEmoteLeaderboardGuildSelectorImage' />{guild.name}</div>
                            );
                        }
                    });

                    // Assemble the table.
                    if(this.state.banData.words[this.state.wordActive] !== undefined){
                        this.state.banData.words[this.state.wordActive].forEach(wd => {
                            // I'd have made the IDs here contain a space instead of an underscore delimiting the word itself and the anti-collision identifier (present to stop michevious requests from adding a word
                            // with an ID matching an element here and breaking the UI), but HTML requires that no whitespace is present in IDs to make them compliant.
                            wordTableEntries.push(<div className='quantecEmoteLeaderboardTableRow quantecBannedWordRow'><p>{wd}</p><hr /><button className='quantecBannedWordDeleteButton' id={'bannedWord_'+wd} onClick={this.bannedWordDeletePressed}>Delete</button></div>);
                        });

                        wordTable = wordTableEntries.length === 0 ? <div className='quantecContentContainerSubContainer quantecAdminSettingsNoData'><h1>{'// NO DATA'}</h1><h2>This server has no banned words.</h2></div> : 
                        <div className='quantecEmoteLeaderboard'>
                            <div className='quantecEmoteLeaderboardTableHeader'>
                                <p>Word</p>
                                <hr />
                            </div>
                            <div className='quantecEmoteLeaderboardBody'>
                                {wordTableEntries}
                            </div>
                        </div>
                    }

                    // Push div to adminPanels.
                    adminPanels.push(
                        <div className='quantecContentContainer'>
                            <h1>Banned Words</h1>
                            <h2>// Administrator Settings</h2>
                            <div className='flexHorizontal'>

                                <div className='QuantecBannedWordsGuildSelectorContainer'>
                                    {wordTableActive}
                                    <div className={this.state.activeDropdown === 'bannedWordSelect' ? 'QuantecEmoteLeaderboardGuildSelectorDropdown': 'QuantecEmoteLeaderboardGuildSelectorDropdown QuantecEmoteLeaderboardGuildSelectorDropdown-hidden'}>
                                        {wordTableInactives}
                                     </div>
                                </div>
                                <hr />
                                <button className='bannedWordsNewButton' id='newBannedWord' onClick={this.launchDialog}><p>Ban Word</p></button>
                            </div>
                            {wordTable}
                        </div>
                    );
                }            

                // Images
                if(this.state.imageActive !== undefined && this.state.banData.guilds[this.state.imageActive] !== undefined){
                    // Set the wordTableActive variable first.
                    imageTableActive = <div className='quantecEmoteLeaderboardGuildSelectorActive' onClick={this.activeClicked} id='bannedImageSelect'><img src={this.state.banData.guilds[this.state.imageActive].iconURL} className='quantecEmoteLeaderboardGuildSelectorImage' /><p>{this.state.banData.guilds[this.state.imageActive].name}</p><hr /><p style={{marginRight: '10px'}}>{'\\/'}</p></div>;
                    
                    // Assemble the inactives. Luckily if a user has permission to modify banned words, they also have permission to modify banned images, so there's remarkably little work needed here.
                    Object.values(this.state.banData.guilds).forEach(guild => {
                        if(guild.id !== this.state.imageActive){
                            imageTableInactives.push(
                                <div className='quantecEmoteLeaderboardGuildSelectorInactive' onClick={this.inactiveClicked} id={guild.id}><img src={guild.iconURL} className='quantecEmoteLeaderboardGuildSelectorImage' />{guild.name}</div>
                            );
                        }
                    });

                    // Assemble the table.
                    if(this.state.banData.images[this.state.imageActive] !== undefined){
                        this.state.banData.images[this.state.imageActive].forEach(img => {
                            // I'd have made the IDs here contain a space instead of an underscore delimiting the word itself and the anti-collision identifier (present to stop michevious requests from adding a word
                            // with an ID matching an element here and breaking the UI), but HTML requires that no whitespace is present in IDs to make them compliant.
                            imageTableEntries.push(<div className='quantecEmoteLeaderboardTableRow'><p>{img.name}</p><hr /><p>{img.adaptive === 'true' ? 'yes' : 'no'}</p><hr /><p>{img.size}</p><hr /><button className='quantecBannedImageTableMutator' id={img.name} onClick={this.downloadBannedImage}>Download</button><button className='quantecBannedImageTableMutator' id='editBannedImage' onClick={event => {
                                console.log(event);
                                this.setState({
                                    formData: {
                                        nick: img.name,
                                        subjOldName: img.name,
                                        adaptive: img.adaptive === 'true'
                                    }
                                }, () => this.launchDialog(event))
                            }}>Edit</button><button className='quantecBannedWordDeleteButton' id={'bannedImage_'+img.name} onClick={this.bannedImageDeletePressed}>Delete</button></div>);
                        });

                        imageTable = imageTableEntries.length === 0 ? <div className='quantecContentContainerSubContainer quantecAdminSettingsNoData'><h1>{'// NO DATA'}</h1><h2>This server has no banned images.</h2></div> : 
                        <div className='quantecEmoteLeaderboard' id='quantecBannedImageTable'>
                            <div className='quantecEmoteLeaderboardTableHeader'>
                                <p>Nickname</p>
                                <hr />
                                <p>Adaptively Filtered?</p>
                                <hr />
                                <p>Number of images used for adaptive aggregate</p>
                                <hr />
                                <p />
                            </div>
                            <div className='quantecEmoteLeaderboardBody quantecBannedWordRow'>
                                {imageTableEntries}
                            </div>
                        </div>
                    }

                    // Push div to adminPanels.
                    adminPanels.push(
                        <div className='quantecContentContainer'>
                            <h1>Banned Images</h1>
                            <h2>// Administrator Settings</h2>
                            <div className='flexHorizontal'>

                                <div className='QuantecBannedWordsGuildSelectorContainer'>
                                    {imageTableActive}
                                    <div className={this.state.activeDropdown === 'bannedImageSelect' ? 'QuantecEmoteLeaderboardGuildSelectorDropdown': 'QuantecEmoteLeaderboardGuildSelectorDropdown QuantecEmoteLeaderboardGuildSelectorDropdown-hidden'}>
                                        {imageTableInactives}
                                     </div>
                                </div>
                                <hr />
                                <button id='setTolerance' className='bannedWordsNewButton' onClick={event => {
                                        this.setState({
                                            formData: {
                                                pcnt: this.state.banData.imagePcnt[this.state.imageActive]
                                            }
                                        }, () => this.launchDialog(event));
                                }}><p>Set Similarity Threshold</p></button>
                                <button className='bannedWordsNewButton' id='newBannedImage' onClick={this.launchDialog}><p>Ban Image</p></button>
                            </div>
                            {imageTable}
                        </div>
                    );
                }            
            }
        } else {
            adminPanels = null;
        }

        // Now make all of the options for other guilds.
        const inactives = [];
        if(this.state.serverData !== undefined && this.state.serverData !== null){
            Object.values(this.state.serverData).forEach(ele => {

                if(ele.id !== this.state.emoteLeaderboardActiveServer.id){
                    inactives.push(<div className='quantecEmoteLeaderboardGuildSelectorInactive' onClick={this.inactiveClicked} id={ele.id}><img src={ele.imageIconURL} className='quantecEmoteLeaderboardGuildSelectorImage' />{ele.name}</div>);
                }
            });
        }

        // Set up dialog boxes, if they are to be displayed.
        var dialogBox;

        switch(this.state.activeDialog){
            case 'newBannedWord':
                dialogBox = 
                    <div className='dialogContainer' onClick={event => event.stopPropagation()}>
                        <h1>New banned word</h1>
                        <h2>// Guild: {this.state.banData.guilds[this.state.wordActive].name}</h2>
                        <form id='newBannedWordForm' onSubmit={this.onDialogFormSubmit}>
                            <input type='text' id='word' onChange={this.onDialogFormChange} value={this.state.formData['word']} />
                            <div className='flexHorizontal'>
                                <input type='button' value='Cancel' id='newBannedWordCancelButton' onClick={this.onDialogCancel} />
                                <hr />
                                <input type='submit' value='Ban' id='newBannedWordBanButton' disabled={this.state.submitDisabled} />
                            </div>
                        </form>
                    </div>;
                break;

            case 'newBannedImage':
                dialogBox =
                    <div className='dialogContainer' onClick={event => event.stopPropagation()}>
                        <h1>New banned image</h1>
                        <h2>// Guild: {this.state.banData.guilds[this.state.imageActive].name}</h2>
                        <form id='newBannedImageForm' onSubmit={this.onBanImageFormSubmit}>
                            <label>
                                Name
                                <br />
                                <input type='text' id='nick' onChange={this.onDialogFormChange} value={this.state.formData['nick']} />
                            </label>
                            <label>
                                Image
                                <br />
                                <div className='flexHorizontal'>
                                    <div id='fileUploadWrapperButton'>
                                        <input type='file' id='fileUpload' accept='image/png, image/gif, image/jpeg, image/webp' onChange={this.onDialogFormChange} files={[this.state.formData['fileUpload']]} />
                                        <p>Choose...</p>
                                    </div>
                                    <hr />
                                    <p id='fileUploadStatusText'>{this.state.formData['statusText'] === undefined ? 'WAITING...' : this.state.formData['statusText']}</p>
                                </div>
                            </label>
                            <div className='flexHorizontal'>
                                <input type='button' value='Cancel' id='newBannedWordCancelButton' onClick={this.onDialogCancel} />
                                <hr />
                                <input type='submit' value='Ban' id='newBannedWordBanButton' disabled={this.state.submitDisabled || !this.state.formData.uploadReady} />
                            </div>
                        </form>
                    </div>;
                break;

            case 'editBannedImage':
                dialogBox =
                    <div className='dialogContainer' onClick={event => event.stopPropagation()}>
                        <h1>// Edit Banned Image</h1>
                        <h2>// {this.state.banData.guilds[this.state.imageActive].name} // {this.state.formData.subjOldName}</h2>
                        <form id='editBannedImageForm' onSubmit={this.onDialogFormSubmit}>
                            <label>
                                <p>Name</p>
                                <br />
                                <input type='text' id='nick' onChange={this.onDialogFormChange} value={this.state.formData.nick} />
                            </label>
                            <br />
                            <label>
                                <p>Adaptive</p>
                                <br />
                                <div id='adaptiveSwitch' className={this.state.formData.adaptive ? 'adaptiveSwitch adaptiveSwitchOn' : 'adaptiveSwitch'} onClick={() => {
                                        var newFormData = this.state.formData;
                                        newFormData['adaptive'] = !this.state.formData.adaptive;
                                        this.setState({formData: newFormData, submitDisabled: this.state.formData.nick === ''});
                                    }
                                }>
                                    <div className={this.state.formData.adaptive ? 'quantecSwitchCircle quantecSwitchCircleOn' : 'quantecSwitchCircle'} />
                                </div>
                            </label>
                            <div className='flexHorizontal'>
                                <input type='button' value='Cancel' id='newBannedWordCancelButton' onClick={this.onDialogCancel} />
                                <hr />
                                <input type='submit' value='Save' id='quantecMutatorDialogSave' className='quantecMutatorDialogSave' disabled={this.state.submitDisabled} />
                            </div>
                        </form>
                    </div>    
                break;

            case 'setTolerance':
                dialogBox = 
                    <div className='dialogContainer' onClick={event => event.stopPropagation()}>
                        <h1>Set Similarity Threshold</h1>
                        <h2>// Guild: {this.state.banData.guilds[this.state.imageActive].name}</h2>
                        <form id='setToleranceForm' onSubmit={this.onDialogFormSubmit}>
                            <p>Images that are at least <input type='text' className='quantecPcnt' id='pcnt' value={this.state.formData.pcnt} onChange={this.onDialogFormChange} />% similar to a banned image and are posted in this server will be removed.</p>
                            <div className='flexHorizontal'>
                                <input type='button' value='Cancel' id='newBannedWordCancelButton' onClick={this.onDialogCancel} />
                                <hr />
                                <input type='submit' value='Save' className='quantecMutatorDialogSave' disabled={this.state.submitDisabled} />
                            </div>
                        </form>
                    </div>;
                break;

            default:
                dialogBox = null;
        }

        return (
            <div className='Quantec'>
                <div className='quantecContentContainer'>
                    <h1>Statistics</h1>
                    <h2>{this.state.analytics === undefined ? 'Fetching from API...' : this.state.analytics === null ? 'Server Error' : '// As of '+this.state.lastAnalyticsFetchTimestamp.toString()}</h2>
                    {this.state.analytics !== undefined ? <div className='flexHorizontal'>
                        <div className='quantecContentContainerSubContainer'>
                            <h1>Analytics</h1>
                            <h2>// QuanTec version {this.state.analytics.botVers}</h2>
                            <table className='quantecAnalyticsTable' cellSpacing={0}>
                                <tbody>
                                    <tr><td><p>Commands Processed:</p></td><td><hr /></td><td>{this.state.analytics.processedCommands}</td></tr>
                                    <tr><td><p>Messages Screened:</p></td><td><hr /></td><td>{this.state.analytics.screenedMessages}</td></tr>
                                    <tr><td><p>Messages Redacted:</p></td><td><hr /></td><td>{this.state.analytics.removedMessages}</td></tr>
                                    <tr><td><p>Images Redacted:</p></td><td><hr /></td><td>{this.state.analytics.blockedImages}</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <hr />
                        <div className='quantecContentContainerSubContainer'>
                            <h1>Humorous Numbers</h1>
                            <h2>// Cultural Artifacts</h2>
                            <table className='quantecAnalyticsTable' cellSpacing={0}>
                                <tbody>
                                    <tr><td><p>Sightings of Fluroginger's pass:</p></td><td><hr /></td><td>{this.state.analytics.flurogingerPassAppearances}</td></tr>
                                    <tr><td><p>Time elapsed since last sighting:</p></td><td><hr /></td><td>{passInterval}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div> : 'Please wait...'}
                    <div className='quantecContentContainerEmoteLeaderboardContainer'>
                        <h1>Emote Leaderboard</h1>
                        <h2>// Note: Only custom emotes belonging to servers that QuanTec is in are tracked. This includes versions of the same emote from different servers.</h2>
                        <div className='QuantecEmoteLeaderboardGuildSelectorContainer'>
                            {active}
                            <div className={this.state.activeDropdown === 'emoteLeaderboardSelect' ? 'QuantecEmoteLeaderboardGuildSelectorDropdown': 'QuantecEmoteLeaderboardGuildSelectorDropdown QuantecEmoteLeaderboardGuildSelectorDropdown-hidden'}>
                                {inactives}
                            </div>
                        </div>
                        {emoteTable}
                    </div>
                </div>
                {adminPanels}
                <div className={this.state.activeDialog === '' ? 'dialogOverlay disabled' : 'dialogOverlay'} onClick={this.onDialogCancel}>
                    {dialogBox}
                </div>
            </div>
        );
    }
}

export default Quantec;