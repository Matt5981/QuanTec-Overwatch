import React from 'react';
import './quantec.css';

class Quantec extends React.Component {
    // TODO
    render() {

        if(!this.props.enabled){
            return;
        }

        return (
            <div className='Quantec'>
                <div className='quantecMessage'>
                    <h1>Coming Soon!</h1>
                </div>
            </div>
        );
    }
}

export default Quantec;