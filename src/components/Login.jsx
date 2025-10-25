import React, { useState } from "react";
import { supabase } from "../services/supabase";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Sign up new user
  const handleSignUp = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      const user = data.user;
      if (!user) throw new Error("User creation failed");

      // Insert into custom table for foreign key use, ignore duplicates
 

      onLogin(user.id);
    } catch (err) {
      alert("Sign-up failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Sign in existing user
  const handleSignIn = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const user = data.user;
      if (!user) throw new Error("Sign-in failed");

      // Ensure user exists in custom table


      onLogin(user.id);
    } catch (err) {
      alert("Sign-in failed: " + err.message);
    } finally {
      setLoading(false);
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
