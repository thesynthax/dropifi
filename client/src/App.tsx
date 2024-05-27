import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import About from './components/About';
import Home from './components/Home';
import Navbar from './components/Navbar';


const App = () => {
  return (
    <Router>
      <div className="App">
        <Navbar />
        <div className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />}/>
            <Route path="*" />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;

