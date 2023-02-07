import React from 'react';
import './fillCircle.css';

class FillCircle extends React.Component {

    render(){
        const circumference = 90 * 2 * Math.PI;
        
        var color;

        if(this.props.percent < 70){
            color = "lime";
        } else if(this.props.percent < 80){
            color = "yellow";
        } else if(this.props.percent < 90){
            color = "orange";
        } else {
            color = "red";
        }

        var pcnt = this.props.percent;

        if(isNaN(this.props.percent)){
            color = "blue";
            pcnt = 100;
        }

        return (
            <div className='fillCircleContainer'>
                <svg className='fillCircle' height="200px" width="200px">
                    <circle className='circleShape' strokeWidth='10' fill='transparent' r='90' cx='100' cy='100' stroke={color} strokeDasharray={180*Math.PI} strokeDashoffset={circumference - pcnt / 100 * circumference}/>
                </svg>
                <h1 id='fillCirclePercentage'>{isNaN(this.props.percent) ? 'N/A' : this.props.percent+'%'}</h1>
            </div>
        )
    }
}

export default FillCircle;
