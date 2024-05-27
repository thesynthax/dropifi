import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <>
      <nav className="navbar">
        <h1>Dropifi</h1>
        <div className="links">
          <Link to="/">Upload</Link>
          <Link to="/about">About</Link>
        </div>
      </nav>
    </>
  )
}

export default Navbar;
