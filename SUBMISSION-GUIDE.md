# Submission guide

How to set up, deploy and submit. The rules are in the project brief. You may delete this file before submitting.

**Due: 31 October 2026, 11:59 pm IST.** You submit one thing: your GitHub repository link.

## 1. Create your repository

1. Sign up at [github.com](https://github.com) if you do not have an account.
2. Copy this template into a new **public** repository:
   - **From a template link:** click **Use this template → Create a new repository**, name it, choose **Public**.
   - **From a zip file:** create a new public repository, click **uploading an existing file**, drag in the unzipped files, and click **Commit changes**.
3. Commit as you go. Your AI coding tool can do this if you ask it to "commit and push my changes". We read the commit history.

## 2. Put your app online

The app must open from a link in a browser, with no install and no sign-up.

| You built | Host |
|---|---|
| Plain HTML / CSS / JavaScript | **GitHub Pages**: repository **Settings → Pages → Deploy from a branch → main**. Keep `index.html` at the repository root. |
| React, Next.js, Vite, or anything with a server | **Vercel** or **Netlify**: sign in with GitHub and import the repository. |
| Python | **Streamlit Community Cloud** or **Hugging Face Spaces** |

Never put an API key in a committed file. Add it in your host's **Environment Variables** or **Secrets** settings, and set a low spending limit with your AI provider.

## 3. Check and submit

Open your repository and your live app in a private (incognito) browser window. Both must open without signing in, and `README.md` must link to the app and the report.

Then email the repository link to **dean.bschool@dempocollege.edu.in** with the subject `Vibe Coding Project – <Roll No> – <Name>`.

We grade the repository as it stood at the deadline. Later commits are ignored.
