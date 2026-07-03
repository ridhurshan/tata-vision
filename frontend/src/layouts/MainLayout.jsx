import Navbar from "../components/common/Navbar";

function MainLayout({ children }) {
    return (
        <>
            <Navbar />
            <main>{children}</main>
        </>
    );
}

export default MainLayout;