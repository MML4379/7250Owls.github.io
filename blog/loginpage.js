import { alertPopups } from "./main.js";
export async function pageLoad(supabase) {
    const container = document.getElementById('container');
    const alert = document.getElementById('alert');
    container.innerHTML = `
        <form id="login-form">
            <input type="email" id="email" placeholder="Email" required>
            <input type="password" id="password" placeholder="Password" required>
            <button type="submit">Login</button>
        </form>`;

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            alertPopups(`Login Error: ${error.message}`);
        } else {
            alertPopups("Welcome back!");
            window.location.hash = ""; // Go home
        }
    });
}
