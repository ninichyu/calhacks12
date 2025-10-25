import React, { useState } from "react";
import { signIn, signUp } from "../services/supabase";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignIn = async () => {
    try {
      const { data, error } = await signIn(email, password);
      if (error) throw error;
      onLogin(data.user.id); // pass user ID to App
    } catch (err) {
      console.error(err);
      alert("Failed to sign in: " + err.message);
    }
  };

  const handleSignUp = async () => {
    try {
      const { data, error } = await signUp(email, password);
      if (error) throw error;
      onLogin(data.user.id);
    } catch (err) {
      console.error(err);
      alert("Failed to sign up: " + err.message);
    }
  };

  return (
    <div>
      <h2>Sign In / Sign Up</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <div style={{ marginTop: "10px" }}>
        <button onClick={handleSignIn}>Sign In</button>
        <button onClick={handleSignUp}>Sign Up</button>
      </div>
    </div>
  );
}
