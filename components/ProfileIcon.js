import { FaUserCircle } from "react-icons/fa";

export default function ProfileIcon({ onClick }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        cursor: "pointer",
        zIndex: 1000, // ensures it stays on top
      }}
      onClick={onClick}
    >
      <FaUserCircle size={36} color="#FFD600" />
    </div>
  );
}