import { useState, useEffect } from 'react';

const App = () => {
    const URL = "http://localhost:5000";
    const [data, setData] = useState("");    

    const getData = async () => {
        const response = await (await fetch(URL)).text();

        setData(response);
    }

    useEffect(() => {
        getData();
    }, []);

    return (
        <div>{data}</div>
    );
}

export default App;
