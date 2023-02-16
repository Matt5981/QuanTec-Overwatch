// I DID NOT WRITE THIS CODE
// TODO find the source of this and appropriately credit the author.
// This code wraps class components in a function component, which allows the use of the navigate and useEffect functions
// from react-router and react respectively inside class components.
import { useNavigate } from 'react-router-dom';

export const withRouter = (Component) => {
    const Wrapper = (props) => {
        const navigate = useNavigate();

        return (
            <Component
            navigate={navigate}
            {...props}
            />
        );
    };

    return Wrapper;
};

// END I DID NOT WRITE THIS CODE