import React from 'react';
import {Navigate} from 'react-router-dom';
import './logout.css';
import { SERVER_IP } from './masterAPIAddress';

class Logout extends React.Component {

    constructor(props){
        super(props);

        this.state = {
            redir: false,
        }

        this.onClick = this.onClick.bind(this);
    }

    onClick(event){
        // Logout clicked, send LOGOUT in a post to API and return to login page. API will invalidate our token.
        fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', credentials: 'include', body: 'LOGOUT'})).then(
            (res) => {
                localStorage.removeItem('btkn');
                localStorage.removeItem('username');
                this.setState({redir: true});
            }
        );
    }

    render(){
        if(!this.props.enabled){
            return;
        }

        if(this.state.redir){
            return <Navigate to='/' />;
        }

        let messages = [
            'Let\'s beat it -- This is turning into a bloodbath!', 
            'Ya know, the next time you come in here I\'m gonna toast ya.', 
            'Go ahead and leave. See if I care.',
            'Get outta here and go back to your boring programs.',
            'Just leave. When you come back, I\'ll be waiting with a bat.',
            'You\'re lucky I don\'t smack you for thinking about leaving.'
        ];

        return (
            <div className='logoutContainer'>
                <div className='logoutBox'>
                    <h1>{messages[Math.floor(Math.random() * toString(messages.length).length) % messages.length]}</h1>
                    <button  id='logoutButton' onClick={this.onClick}>Logout</button>
                </div>
            </div>
        );


    }
}

export default Logout;