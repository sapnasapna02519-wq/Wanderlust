const crypto = require("crypto");
const User = require("../models/user");
const { sendResetEmail } = require("../utils/mailer");

function sanitizeAuthInput(input = {}) {
  return {
    username: typeof input.username === "string" ? input.username.trim() : "",
    email: typeof input.email === "string" ? input.email.trim().toLowerCase() : "",
    password: typeof input.password === "string" ? input.password.trim() : "",
  };
}

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL || "http://localhost:8080/auth/google/callback";

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, callbackUrl };
}

function buildGoogleLoginUrl(returnTo = "") {
  const safeReturnTo =
    typeof returnTo === "string" && returnTo.startsWith("/") ? returnTo : "";
  return safeReturnTo
    ? `/auth/google?returnTo=${encodeURIComponent(safeReturnTo)}`
    : "/auth/google";
}

function encodeState(payload = {}) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeState(value = "") {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function sanitizeUsernameCandidate(value) {
  const raw = (value || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  return raw.length >= 3 ? raw.slice(0, 24) : `user_${raw.padEnd(3, "0")}`.slice(0, 24);
}

async function getAvailableUsername(baseValue) {
  const base = sanitizeUsernameCandidate(baseValue);
  let candidate = base;
  let counter = 1;

  while (await User.findOne({ username: candidate })) {
    candidate = `${base.slice(0, 20)}${counter}`;
    counter += 1;
  }

  return candidate;
}

module.exports.renderSignup = (req, res) => {
  const googleAuthEnabled = Boolean(getGoogleConfig());
  res.render("auth/signup.ejs", {
    formData: {},
    errors: {},
    googleAuthEnabled,
    googleSignupUrl: buildGoogleLoginUrl("/listings"),
  });
};

module.exports.signup = async (req, res) => {
  const formData = sanitizeAuthInput(req.body.user);
  const errors = {};

  if (formData.username.length < 3) {
    errors.username = "Username must be at least 3 characters.";
  }
  if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
    errors.email = "Please provide a valid email address.";
  }
  if (formData.password.length < 6) {
    errors.password = "Password must be at least 6 characters.";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).render("auth/signup.ejs", {
      formData,
      errors,
      googleAuthEnabled: Boolean(getGoogleConfig()),
      googleSignupUrl: buildGoogleLoginUrl("/listings"),
    });
  }

  try {
    const user = await User.register(formData);
    await req.createSession(user);
    res.redirect("/listings?success=Welcome! Your account has been created.");
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.email) {
        errors.email = "Email already in use.";
      } else {
        errors.username = "Username already taken.";
      }
      return res.status(400).render("auth/signup.ejs", {
        formData,
        errors,
        googleAuthEnabled: Boolean(getGoogleConfig()),
        googleSignupUrl: buildGoogleLoginUrl("/listings"),
      });
    }

    if (error.name === "ValidationError") {
      for (const [key, value] of Object.entries(error.errors)) {
        errors[key] = value.message;
      }
      return res.status(400).render("auth/signup.ejs", {
        formData,
        errors,
        googleAuthEnabled: Boolean(getGoogleConfig()),
        googleSignupUrl: buildGoogleLoginUrl("/listings"),
      });
    }

    res.redirect("/auth/signup?error=Unable to create account right now.");
  }
};

module.exports.renderLogin = (req, res) => {
  const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "";
  res.render("auth/login.ejs", {
    formData: {},
    errors: {},
    returnTo,
    googleAuthEnabled: Boolean(getGoogleConfig()),
    googleLoginUrl: buildGoogleLoginUrl(returnTo),
  });
};

module.exports.login = async (req, res) => {
  const formData = sanitizeAuthInput(req.body.user);
  const errors = {};

  if (!formData.email) errors.email = "Email is required.";
  if (!formData.password) errors.password = "Password is required.";

  if (Object.keys(errors).length > 0) {
      const returnTo = typeof req.body.returnTo === "string" ? req.body.returnTo : "";
      return res.status(400).render("auth/login.ejs", {
        formData,
        errors,
        returnTo,
        googleAuthEnabled: Boolean(getGoogleConfig()),
        googleLoginUrl: buildGoogleLoginUrl(returnTo),
      });
  }

  try {
    const user = await User.findOne({ email: formData.email });

    if (!user || !user.verifyPassword(formData.password)) {
      const returnTo = typeof req.body.returnTo === "string" ? req.body.returnTo : "";
      return res.status(401).render("auth/login.ejs", {
        formData,
        errors: { email: "Invalid credentials." },
        returnTo,
        googleAuthEnabled: Boolean(getGoogleConfig()),
        googleLoginUrl: buildGoogleLoginUrl(returnTo),
      });
    }

    await req.createSession(user);
    const redirectUrl =
      typeof req.body.returnTo === "string" && req.body.returnTo.startsWith("/")
        ? req.body.returnTo
        : "/listings";
    res.redirect(`${redirectUrl}${redirectUrl.includes("?") ? "&" : "?"}success=Welcome back, ${user.username}!`);
  } catch (error) {
    res.redirect("/auth/login?error=Unable to login right now.");
  }
};

module.exports.googleAuth = (req, res) => {
  const config = getGoogleConfig();
  if (!config) {
    return res.redirect("/auth/login?error=Google login is not configured.");
  }

  const returnTo =
    typeof req.query.returnTo === "string" && req.query.returnTo.startsWith("/")
      ? req.query.returnTo
      : "/listings";
  const state = encodeState({ returnTo });

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.callbackUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  return res.redirect(authUrl.toString());
};

module.exports.googleCallback = async (req, res) => {
  const config = getGoogleConfig();
  if (!config) {
    return res.redirect("/auth/login?error=Google login is not configured.");
  }

  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!code) {
    return res.redirect("/auth/login?error=Google login failed. Missing auth code.");
  }

  const statePayload = decodeState(typeof req.query.state === "string" ? req.query.state : "");
  const returnTo =
    typeof statePayload.returnTo === "string" && statePayload.returnTo.startsWith("/")
      ? statePayload.returnTo
      : "/listings";

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.callbackUrl,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      return res.redirect("/auth/login?error=Unable to authenticate with Google.");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return res.redirect("/auth/login?error=Google auth token missing.");
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileResponse.ok) {
      return res.redirect("/auth/login?error=Unable to fetch Google profile.");
    }

    const profile = await profileResponse.json();
    if (!profile || !profile.sub || !profile.email) {
      return res.redirect("/auth/login?error=Google profile is incomplete.");
    }

    let user = await User.findOne({ googleId: profile.sub });
    if (!user) {
      user = await User.findOne({ email: String(profile.email).toLowerCase() });
      if (user && !user.googleId) {
        user.googleId = profile.sub;
        user.avatar = profile.picture || user.avatar;
        await user.save();
      }
    }

    if (!user) {
      const username = await getAvailableUsername(
        profile.name || String(profile.email).split("@")[0]
      );
      const randomPassword = crypto.randomBytes(24).toString("hex");
      user = await User.register({
        username,
        email: String(profile.email).toLowerCase(),
        password: randomPassword,
      });
      user.googleId = profile.sub;
      user.avatar = profile.picture || "";
      await user.save();
    }

    await req.createSession(user);
    return res.redirect(
      `${returnTo}${returnTo.includes("?") ? "&" : "?"}success=Logged in with Google`
    );
  } catch (error) {
    return res.redirect("/auth/login?error=Google login failed. Please try again.");
  }
};

module.exports.logout = async (req, res) => {
  await req.destroySession();
  res.redirect("/listings?success=Logged out successfully.");
};

module.exports.renderProfile = async (req, res) => {
  const user = await User.findById(req.currentUser.id);
  if (!user) {
    await req.destroySession();
    return res.redirect("/auth/login?error=Session expired, please login again.");
  }
  res.render("auth/profile.ejs", {
    formData: {
      username: user.username,
      email: user.email,
    },
    errors: {},
  });
};

module.exports.updateProfile = async (req, res) => {
  const formData = sanitizeAuthInput(req.body.user);
  const errors = {};

  if (formData.username.length < 3) {
    errors.username = "Username must be at least 3 characters.";
  }
  if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
    errors.email = "Please provide a valid email address.";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).render("auth/profile.ejs", { formData, errors });
  }

  const existingEmail = await User.findOne({
    email: formData.email,
    _id: { $ne: req.currentUser.id },
  });
  if (existingEmail) {
    return res.status(400).render("auth/profile.ejs", {
      formData,
      errors: { email: "Email already in use." },
    });
  }

  const existingUsername = await User.findOne({
    username: formData.username,
    _id: { $ne: req.currentUser.id },
  });
  if (existingUsername) {
    return res.status(400).render("auth/profile.ejs", {
      formData,
      errors: { username: "Username already taken." },
    });
  }

  const user = await User.findByIdAndUpdate(
    req.currentUser.id,
    {
      username: formData.username,
      email: formData.email,
    },
    { new: true, runValidators: true }
  );

  await req.refreshSessionUser(user);
  res.redirect("/auth/profile?success=Profile updated successfully.");
};

module.exports.renderChangePassword = (req, res) => {
  res.render("auth/change-password.ejs", {
    errors: {},
  });
};

module.exports.changePassword = async (req, res) => {
  const currentPassword =
    typeof req.body.currentPassword === "string"
      ? req.body.currentPassword.trim()
      : "";
  const newPassword =
    typeof req.body.newPassword === "string" ? req.body.newPassword.trim() : "";
  const confirmPassword =
    typeof req.body.confirmPassword === "string"
      ? req.body.confirmPassword.trim()
      : "";

  const errors = {};
  if (!currentPassword) errors.currentPassword = "Current password is required.";
  if (newPassword.length < 6) {
    errors.newPassword = "New password must be at least 6 characters.";
  }
  if (newPassword !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).render("auth/change-password.ejs", { errors });
  }

  const user = await User.findById(req.currentUser.id);
  if (!user || !user.verifyPassword(currentPassword)) {
    return res.status(400).render("auth/change-password.ejs", {
      errors: { currentPassword: "Current password is incorrect." },
    });
  }

  user.setPassword(newPassword);
  user.resetTokenHash = null;
  user.resetTokenExpiresAt = null;
  await user.save();

  res.redirect("/auth/profile?success=Password changed successfully.");
};

module.exports.renderForgotPassword = (req, res) => {
  res.render("auth/forgot-password.ejs", {
    formData: {},
    errors: {},
    resetLink: null,
    resetRequested: false,
  });
};

module.exports.sendResetLink = async (req, res) => {
  const email =
    typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).render("auth/forgot-password.ejs", {
      formData: { email },
      errors: { email: "Please provide a valid email address." },
      resetLink: null,
      resetRequested: false,
    });
  }

  const user = await User.findOne({ email });
  let resetLink = null;
  let showResetLink = false;
  if (user) {
    const token = crypto.randomBytes(24).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    user.resetTokenHash = tokenHash;
    user.resetTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 30);
    await user.save();
    const baseUrl = process.env.APP_BASE_URL || `http://localhost:8080`;
    resetLink = `${baseUrl}/auth/reset-password/${token}`;
    try {
      const result = await sendResetEmail({ to: user.email, resetLink });
      showResetLink = !result.sent;
    } catch (error) {
      showResetLink = true;
    }
  }

  const shouldShowDevLink =
    String(process.env.SHOW_RESET_LINK_IN_UI || "").toLowerCase() === "true";

  res.render("auth/forgot-password.ejs", {
    formData: { email: "" },
    errors: {},
    resetLink: shouldShowDevLink && showResetLink ? resetLink : null,
    resetRequested: true,
  });
};

module.exports.renderResetPassword = async (req, res) => {
  const { token } = req.params;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    resetTokenHash: tokenHash,
    resetTokenExpiresAt: { $gt: new Date() },
  });

  if (!user) {
    return res.redirect("/auth/forgot-password?error=Reset link is invalid or expired.");
  }

  res.render("auth/reset-password.ejs", {
    token,
    errors: {},
  });
};

module.exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const newPassword =
    typeof req.body.newPassword === "string" ? req.body.newPassword.trim() : "";
  const confirmPassword =
    typeof req.body.confirmPassword === "string"
      ? req.body.confirmPassword.trim()
      : "";

  const errors = {};
  if (newPassword.length < 6) {
    errors.newPassword = "Password must be at least 6 characters.";
  }
  if (newPassword !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }
  if (Object.keys(errors).length > 0) {
    return res.status(400).render("auth/reset-password.ejs", { token, errors });
  }

  const user = await User.findOne({
    resetTokenHash: tokenHash,
    resetTokenExpiresAt: { $gt: new Date() },
  });

  if (!user) {
    return res.redirect("/auth/forgot-password?error=Reset link is invalid or expired.");
  }

  user.setPassword(newPassword);
  user.resetTokenHash = null;
  user.resetTokenExpiresAt = null;
  await user.save();

  res.redirect("/auth/login?success=Password reset successfully. Please login.");
};
