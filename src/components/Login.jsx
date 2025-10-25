import React, { useState } from "react";
import { signIn, signUp, supabase } from "../services/supabase";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignUp = async () => {
    try {

      const { data: existingUsers, error: fetchError } = await supabase
        .from("users")
        .select("*")
        .eq("email", email);

      if (fetchError) throw fetchError;

      if (existingUsers && existingUsers.length > 0) {
        // User already exists — try signing them in instead
        alert("User already exists, signing you in...");
        return await handleSignIn();
      }
      
      const { data, error } = await signUp(email, password);
      if (error) throw error;

      // Once user is created, add them to your custom table
      const user = data.user;
      if (user) {
        const { error: insertError } = await supabase
          .from("users")
          .insert([{ id: user.id, email: user.email }]);
        if (insertError) throw insertError;
      }

      onLogin(user.id);
    } catch (err) {
      alert("Failed to sign up: " + err.message);
    }
  };

  const handleSignIn = async () => {
    try {
      const { data, error } = await signIn(email, password);
      if (error) throw error;
      onLogin(data.user.id);
    } catch (err) {
      alert("Failed to sign in: " + err.message);
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
