import { useState, useRef, useEffect } from "react";
import { auth } from "../lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import ProfileIcon from "./ProfileIcon";

export default function GoogleLogin() {
  const [user] = useAuthState(auth);
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => user ? setOpen((v) => !v) : signInWithGoogle()}>
        <ProfileIcon />
      </button>
      {open && user && (
        <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-yellow-400 rounded shadow-lg z-50">
          <div className="px-4 py-2 text-yellow-200 border-b border-yellow-400">
            <div className="font-semibold">{user.displayName || user.email}</div>
          </div>
          <button
            className="w-full text-left px-4 py-2 text-yellow-100 hover:bg-yellow-400 hover:text-black"
            onClick={() => { signOut(auth); setOpen(false); }}
          >
            Sign Out
          </button>
        </div>
      )}
      {!user && (
        <button
          className="ml-2 px-3 py-1 bg-yellow-400 text-black rounded hover:bg-yellow-500"
          onClick={signInWithGoogle}
        >
          Login
        </button>
      )}
    </div>
  );
}