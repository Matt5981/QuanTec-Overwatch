import React from 'react';
import './dashboard.css';
import FillCircle from './fillCircle.js';
import {Navigate} from 'react-router-dom';
import './UserClassHeirarchy.js';
import { USER_CLASSES } from './UserClassHeirarchy.js';
import { SERVER_IP } from './masterAPIAddress';

class Dashboard extends React.Component {
    constructor(props){
        super(props);

        // Update all of these with an AJAX call. TODO reimplement loading screen from Console.js to a separate component so it can be stuck here too while retrieving data.
        this.state = {
            kill: false,
            uptime: undefined,
            storage: {
                boot: {
                    used: undefined,
                    total: undefined
                },
                storage: {
                    used: undefined,
                    total: undefined
                },
                lxd: {
                    used: undefined,
                    total: undefined
                }
            },
            containers: [],
            interval: undefined
        };

        this.stopStartClick = this.stopStartClick.bind(this);
    }

    componentDidMount(){
        this.setState({
            interval: setInterval(() => this.updateData(), 1000)
        });

        fetch(new Request(SERVER_IP, {method: "POST", mode: 'cors', credentials: 'include', body: 'GETMEMUSAGE'})).catch(NetworkError => {
            localStorage.clear();
            localStorage.setItem('kickoutReferralReason', 'badResponseFromServer');
            this.setState({
                kill: true
            });
            return null; 
        }).then(
            (resp) => {return resp.json();}
        ).then(
            (resp) => {
                // We now have some JSON to play with.
                this.setState({
                    uptime: resp.uptime,
                    storage: {
                        boot: {
                            used: resp.storage.bootused,
                            total: resp.storage.boottotal
                        },
                        storage: {
                            used: resp.storage.storageused,
                            total: resp.storage.storagetotal
                        },
                        lxd: {
                            used: resp.storage.lxdused,
                            total: resp.storage.lxdtotal
                        }
                    }
                });
            }
        );

        fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', credentials: 'include', body: 'GETCONTAINERS'})).then(
            res => {return res.json();}
        ).then(
            res => {
                this.setState({containers: res.containers});
            }
        );
    }

    componentWillUnmount(){
        clearInterval(this.state.interval);
    }

    updateData(){
        fetch(new Request(SERVER_IP, {method: "POST", mode: 'cors', credentials: 'include', body: 'GETMEMUSAGE'})).catch(NetworkError => {
            localStorage.clear();
            localStorage.setItem('kickoutReferralReason', 'badResponseFromServer');
            this.props.killPtr();
            console.log('killPtr returned...');
            return null; 
        }).then(
            (resp) => {
                if(resp.status === 200){
                    return resp.json();
                } else {
                    // Since this request ALWAYS succeeds if we're logged in, if it returns anything that isn't 200 we've either been logged out or the server has crashed. As such, we'll poison the whole app by
                    // wiping LS, then forcing react to re-render a <Navigate>.
                    localStorage.clear();
                    localStorage.setItem('kickoutReferralReason', 'badResponseFromServer');
                    this.props.killPtr();
                    console.log('killPtr returned...');
                    return null;
                }
            }
        ).then(
            (resp) => {
                // We now have some JSON to play with.
                this.setState({
                    uptime: resp.uptime,
                    storage: {
                        boot: {
                            used: resp.storage.bootused,
                            total: resp.storage.boottotal
                        },
                        storage: {
                            used: resp.storage.storageused,
                            total: resp.storage.storagetotal
                        },
                        lxd: {
                            used: resp.storage.lxdused,
                            total: resp.storage.lxdtotal
                        }
                    }
                });
            }
        );

        fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', credentials: 'include', body: 'GETCONTAINERS'})).then(
            res => {return res.json();}
        ).then(
            res => {
                this.setState({containers: res.containers});
            }
        );
    }

    uptimeFormat(){
        let days = Math.floor(this.state.uptime / 86400);
        var printstring = (days === 1) ? "1 day, " : days+" days, ";

        var remainder = this.state.uptime % 86400;
        let hours = Math.floor(remainder / 3600);
        printstring += (hours === 1) ? "1 hour, " : hours+" hours, ";

        remainder %= 3600;
        let minutes = Math.floor(remainder / 60);
        printstring += (minutes === 1) ? "1 minute, " : minutes+" minutes, ";

        remainder %= 60;
        printstring += (remainder === 1) ? "1 second." : remainder+" seconds.";
                   
        return printstring;
    }

    // TODO configurable display units for size.
    sizeFormat(inBytes){
        // the API returns bytes. We'll use the user's settings to adjust what we return here.
        let settings = JSON.parse(localStorage.getItem('usrSettings'));
        var dplUnits = settings.strDplUnits;
        let acc = settings.strAcc;
        // From that we need to do some work, since the display units are a string and not a multiplier.
        var accuracy = Math.pow(10, acc);
        var units;
        switch(dplUnits){
            case "KB":
                units = 1000;
                break;
            case "MB":
                units = 1000000;
                break;
            case "GB":
                units = 1000000000;
                break;
            case "TB":
                units = 1000000000000;
                break;
            default:
                units = 1000000000;
                dplUnits = "GB";
                break;
        }
        
        return (Math.round((inBytes/units) * accuracy) / accuracy) + dplUnits;
    }

    stopStartClick(event){
        var target = event.target.id;
        // Work out whether we're starting or stopping by the class name of the button.
        var willStop = event.target.className.endsWith(' containerStop') ? 'STOPSERVICE' : 'STARTSERVICE';

        event.target.enabled = false;

        fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', credentials: 'include', body: willStop+'\n'+target})).then(
            res => {
                if(res.status === 204){
                    // Call updateData early.
                    
                } else {
                    alert('Server returned '+res.status+'. This likely means starting/stopping this container failed. THIS MESSAGE IS A PLACEHOLDER AND WILL BE REPLACED SHORTLY.');
                }
                this.updateData();
            }
        );
    }

    render(){

        if(!this.props.enabled){
            return;
        }

        if(this.state.kill){
            return (<Navigate to='/' replace={true} />);
        }
        
        // Declutter the return.
        var bootpcnt = Math.round(((this.state.storage.boot.total - this.state.storage.boot.used) / this.state.storage.boot.total) * 100);
        var storagepcnt = Math.round(((this.state.storage.storage.total - this.state.storage.storage.used) / this.state.storage.storage.total) * 100);
        var lxdpcnt = Math.round(((this.state.storage.lxd.total - this.state.storage.lxd.used) / this.state.storage.lxd.total) * 100);
        
        // All of them need null checks since they're NaN at first, which sets the fill circles to full as it's the N/A condition. 
        if(this.state.storage.boot.total === undefined && this.state.storage.boot.used === undefined) bootpcnt = 0;
        if(this.state.storage.storage.total === undefined && this.state.storage.storage.used === undefined) bootpcnt = 0;
        if(this.state.storage.lxd.total === undefined && this.state.storage.lxd.used === undefined) bootpcnt = 0;

        // Dynamically generate entries in the active servers table. We usually don't have more then three at once, so it's a bit redundant, but useful since
        // this front end occupies one, leaving two others.
        let tableContents = [];
        this.state.containers.forEach(ele => {

            // Discern state.
            var finalState;
            var button;
            if(ele.state === 'RUNNING'){
                if(ele.status === 'active (running)'){
                    finalState = 'active';
                    button = ' containerStop';
                } else if(ele.status === 'inactive (dead)'){
                    finalState = 'inactive';
                    button = ' containerStart';
                } else {
                    finalState = 'crashed';
                    button = ' containerStart';
                }
            } else {
                finalState = 'stopped';
                button = null;
            }

            // If the 'ports' field isn't null, draw another <td> that has the list of ports shown.
            if(ele.ports !== null){

                var portString = '';
                ele.ports.forEach(ele => {
                    portString += (ele + ', ');
                })
                portString = portString.slice(0, -2);

                tableContents.push(<tr><td>{ele.name}</td><td>{portString}</td><td className='flexHorizontal'><ul><li className={finalState}>{finalState}</li></ul><hr />{(USER_CLASSES[localStorage.getItem('usrClass')] >= USER_CLASSES['ADMINISTRATOR'] && button !== null) ? <button className={'containerStopStart' + button} id={ele.name} onClick={this.stopStartClick}>{(button === ' containerStart') ? 'Start' : 'Stop'}</button> : null}</td></tr>);
            } else {
                tableContents.push(<tr><td>{ele.name}</td><td className='flexHorizontal'><ul><li className={finalState}>{finalState}</li></ul><hr />{(USER_CLASSES[localStorage.getItem('usrClass')] >= USER_CLASSES['ADMINISTRATOR'] && button !== null) ? <button className={'containerStopStart' + button} id={ele.name} onClick={this.stopStartClick}>{(button === ' containerStart') ? 'Start' : 'Stop'}</button> : null}</td></tr>);
            }

        });

        return (
            <div className='dashboard'>
                <br />
                <div className='dashboardOverview'>
                    <h1>QuanTec Server Details</h1>
                    <h2>Public IP: <span className='code'>59.167.203.71</span></h2>
                    <h2>Domain: <span className='code'>thegaff.dev</span></h2>
                    <h2>Uptime: <span className='code'>{this.uptimeFormat()}</span></h2>
                </div>
                <div className='dashboardStorage'>
                    <h1>Server Storage</h1>
                    <div className='horizontalTable'>
                        <div className='storageWheelContainer' id='bootStorageWheel'>
                            <FillCircle percent={bootpcnt}/>
                            <h2>Boot: {this.sizeFormat(this.state.storage.boot.total - this.state.storage.boot.used)}/{this.sizeFormat(this.state.storage.boot.total)}</h2>
                        </div>
                        <div className='storageWheelContainer' id='storageStorageWheel'>
                            <FillCircle percent={storagepcnt}/>
                            <h2>Storage: {this.sizeFormat(this.state.storage.storage.total - this.state.storage.storage.used)}/{this.sizeFormat(this.state.storage.storage.total)}</h2>
                        </div>
                        <div className='storageWheelContainer' id='lxdStorageWheel'>
                            <FillCircle percent={lxdpcnt} />
                            <h2>LXD: {this.sizeFormat(this.state.storage.lxd.total - this.state.storage.lxd.used)}/{this.sizeFormat(this.state.storage.lxd.total)}</h2>
                        </div>
                    </div>
                </div>
                <div className='dashboardActives'>
                    <h1>Active Servers</h1>
                    <table cellSpacing={0}>
                        <tbody>
                            {tableContents}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}

export default Dashboard;