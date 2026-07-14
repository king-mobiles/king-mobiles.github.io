import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBW-skkBmdt3a1oy9l7pyMaR7LI78K4mVU",
  authDomain: "king-mobiles-ucp.firebaseapp.com",
  projectId: "king-mobiles-ucp",
  storageBucket: "king-mobiles-ucp.firebasestorage.app",
  messagingSenderId: "80949270421",
  appId: "1:80949270421:web:f0102c362c22121f09489c",
  measurementId: "G-1PBHNWPRX7",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Google Drive Image Utilities
function extractDriveId(input) {
  if (!input) return "";
  input = input.trim();

  // Check if it's already a thumbnail URL
  if (input.includes("drive.google.com/thumbnail")) {
    const match = input.match(/[?&]id=([a-zA-Z0-9_-]{25,100})/);
    if (match && match[1]) return match[1];
  }

  // Check for standard file share URLs
  if (input.includes("drive.google.com") || input.includes("docs.google.com")) {
    // Match /file/d/ID
    let match = input.match(/\/d\/([a-zA-Z0-9_-]{25,100})/);
    if (match && match[1]) return match[1];

    // Match ?id=ID
    match = input.match(/[?&]id=([a-zA-Z0-9_-]{25,100})/);
    if (match && match[1]) return match[1];
  }

  // If it matches alphanumeric pattern of standard Drive ID length
  if (/^[a-zA-Z0-9_-]{25,100}$/.test(input)) {
    return input;
  }

  return input;
}

function isDriveThumbnailUrl(url) {
  return (
    url && typeof url === "string" && url.includes("drive.google.com/thumbnail")
  );
}

function formatDateTimeLocal(dateString) {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (e) {
    return "";
  }
}

// Password Hashing Utility (SHA-256)
async function hashPassword(password) {
  if (!password) return "";
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

// Application State
let loggedIn = false;
let currentTab = "shop-info";
let localDataStore = {}; // Holds local copy of the fetched Firebase documents
let editingItemIndex = null; // Keeps track of index when editing array item in a modal
let editingUserUsername = null; // Keeps track of username when editing a user

// Toast Notification Helper
function showToast(title, desc, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  let icon = "✓";
  if (type === "error") icon = "✕";

  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-desc">${desc}</div>
    </div>
    <div class="toast-close">✕</div>
  `;

  container.appendChild(toast);

  // Slide in
  setTimeout(() => toast.classList.add("show"), 10);

  // Close handler
  toast.querySelector(".toast-close").addEventListener("click", () => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 350);
  });

  // Auto remove
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 350);
    }
  }, 4000);
}

// Header profile sync helper
function updateHeaderProfileUI(userData) {
  if (!userData) {
    userData = {
      name: "System Admin",
      role: "Firestore Database Owner",
      avatar: "AD",
    };
  }
  const avatarEl = document.getElementById("header-avatar");
  const nameEl = document.getElementById("header-name");
  const roleEl = document.getElementById("header-role");
  if (avatarEl)
    avatarEl.textContent =
      userData.avatar || userData.name?.substring(0, 2).toUpperCase() || "AD";
  if (nameEl) nameEl.textContent = userData.name || "System Admin";
  if (roleEl) roleEl.textContent = userData.role || "Administrator";
}

// Check Authentication on Page Load
function checkAuth() {
  const sessionToken = sessionStorage.getItem("king_admin_session");
  if (sessionToken === "authenticated") {
    loggedIn = true;
    const cachedUser = sessionStorage.getItem("king_admin_user");
    if (cachedUser) {
      try {
        updateHeaderProfileUI(JSON.parse(cachedUser));
      } catch (e) {
        updateHeaderProfileUI(null);
      }
    }
    showDashboard();
  } else {
    loggedIn = false;
    showLoginScreen();
  }
}

function showLoginScreen() {
  document.getElementById("auth-section").style.display = "flex";
  document.getElementById("dashboard-section").style.display = "none";
}

function showDashboard() {
  document.getElementById("auth-section").style.display = "none";
  document.getElementById("dashboard-section").style.display = "flex";

  // Transition class trigger
  setTimeout(() => {
    document.getElementById("dashboard-section").classList.add("show");
  }, 50);

  // Load the initial tab data
  loadTab(currentTab);
}

// Login verification
window.handleLogin = async function (e) {
  e.preventDefault();

  const userEl = document.getElementById("username");
  const passEl = document.getElementById("password");
  const errEl = document.getElementById("login-error");

  const username = userEl.value.trim();
  const password = passEl.value;

  const submitBtn = e.target.querySelector("button[type='submit']");
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Verifying...`;

  try {
    const userDocRef = doc(db, "users", username.toLowerCase());
    const userSnap = await getDoc(userDocRef);

    let authenticated = false;
    let userData = null;

    if (userSnap.exists()) {
      userData = userSnap.data();
      const enteredHash = await hashPassword(password);
      // Support both SHA-256 hashed password verification and plaintext fallback
      if (userData.password === enteredHash || userData.password === password) {
        authenticated = true;
      }
    } else {
      // Fallback superadmin check if database has no users or is not configured
      if (username.toUpperCase() === "ADMIN" && password === "Admin@123") {
        authenticated = true;
        userData = {
          username: "admin",
          name: "System Admin",
          role: "Firestore Database Owner",
          avatar: "AD",
          password: await hashPassword("Admin@123"),
          isAdmin: true,
        };
      }
    }

    if (authenticated) {
      // Force admin status if username is "admin"
      if (userData.username?.toLowerCase() === "admin") {
        userData.isAdmin = true;
      }
      sessionStorage.setItem("king_admin_session", "authenticated");
      sessionStorage.setItem("king_admin_user", JSON.stringify(userData));
      loggedIn = true;
      errEl.style.display = "none";
      userEl.value = "";
      passEl.value = "";

      updateHeaderProfileUI(userData);
      showDashboard();
      showToast("Login Success", `Welcome back, ${userData.name || username}.`);
    } else {
      errEl.textContent = "Invalid Admin ID or Password.";
      errEl.style.display = "flex";
    }
  } catch (err) {
    console.error("Login verification error:", err);
    errEl.textContent = "Database connection error. Try again.";
    errEl.style.display = "flex";
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
};

// Logout Function
window.handleLogout = function () {
  sessionStorage.removeItem("king_admin_session");
  sessionStorage.removeItem("king_admin_user");
  loggedIn = false;

  const dashboard = document.getElementById("dashboard-section");
  dashboard.classList.remove("show");

  setTimeout(() => {
    dashboard.style.display = "none";
    showLoginScreen();
    showToast("Logged Out", "You have been safely logged out.");
  }, 350);
};

// Tab Switch Handler
window.switchTab = function (tabName) {
  if (currentTab === tabName) return;

  // Update UI Sidebar selection
  document.querySelectorAll(".menu-item").forEach((item) => {
    if (item.getAttribute("data-tab") === tabName) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Close sidebar on mobile after clicking
  const sidebar = document.getElementById("sidebar");
  if (sidebar && sidebar.classList.contains("open")) {
    sidebar.classList.remove("open");
  }

  // Fade out old content and load new
  const activePanel = document.querySelector(".content-section.active");
  if (activePanel) {
    activePanel.classList.remove("active");
  }

  currentTab = tabName;
  loadTab(tabName);
};

// Firebase Data Fetching
async function loadTab(tabName) {
  const container = document.getElementById(`${tabName}-panel`);
  if (!container) return;

  // Add active state to container
  container.classList.add("active");

  // Show loading indicator in panel content
  const contentBody = container.querySelector(".panel-content-body");
  if (contentBody) {
    contentBody.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 0; gap: 15px; color: var(--gray);">
        <div class="spinner" style="width: 40px; height: 40px; border-width: 3px; color: var(--gold);"></div>
        <p style="font-size: 0.9rem;">Fetching data from Firestore...</p>
      </div>
    `;
  }

  try {
    let data = null;

    if (tabName === "shop-info" || tabName === "hero-footer") {
      // Get base-info doc
      const docRef = doc(db, "shop-info", "base-info");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        data = docSnap.data();
      }
    } else if (tabName === "profile") {
      // Fetch users list from Firestore
      const usersColRef = collection(db, "users");
      const usersSnap = await getDocs(usersColRef);
      const usersList = [];
      usersSnap.forEach((uDoc) => {
        usersList.push(uDoc.data());
      });
      data = { users: usersList };
    } else {
      // Get website collections
      const docRef = doc(db, "website", tabName);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        data = docSnap.data();
      }
    }

    // Save fetched data to local store for edits
    localDataStore[tabName] = data || getFallbackData(tabName);

    // Render the custom edit panel UI
    renderEditPanel(tabName, localDataStore[tabName], contentBody);
  } catch (error) {
    console.error("Error fetching Firestore document: ", error);
    showToast("Error", "Could not fetch document. Please try again.", "error");
    if (contentBody) {
      contentBody.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #ff8880;">
          <p style="display: flex; align-items: center; justify-content: center; gap: 8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--red);"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> Failed to load content from Firebase. Verify database connectivity.</p>
          <button class="btn btn-secondary" onclick="loadTab('${tabName}')" style="margin-top: 15px;">Retry Fetch</button>
        </div>
      `;
    }
  }
}

// Fallback data generators in case Firestore document is empty
function getFallbackData(tabName) {
  switch (tabName) {
    case "shop-info":
      return {
        phone: "+91 73394 80350",
        whatsapp: "+91 73394 80350",
        mail: "kingmobiles@gmail.com",
        address:
          "ST Complex, Van stand Opposite; Uchipuli, Ramanathapuram; Tamil Nadu — 623534",
        short_address: "ST Complex, Van stand Opp, Uchipuli",
        business_hours: "9:00 AM – 9:30 PM",
        weekdays_timing: "9 AM – 9.30 PM",
        weekend_timing: "9 AM – 9.30 PM",
        map_pin_link:
          "https://maps.google.com/maps?q=King%20Mobiles%20%26%20Communications,Uchipuli&output=embed",
        map_share_link: "https://maps.app.goo.gl/t8JPHFPkwdGYWNrs9",
        hero_slogan:
          "Your one-stop destination for smartphones, accessories & expert mobile services in Uchipuli, Ramanathapuram.",
        hero_tags: [
          "Genuine Products",
          "Official Brand Partner",
          "Expert Service",
          "Warranty Support",
          "Local Trusted Store",
        ],
        hero_stats: [
          { value: 2, suffix: "+", label: "Years Experience" },
          { value: 1000, suffix: "+", label: "Happy Customers" },
          { value: 100, suffix: "+", label: "Products Available" },
          { value: 7, suffix: "+", label: "Official Brand Partners" },
        ],
        footer_slogan:
          "Your trusted mobile shop in Uchipuli for original smartphones, genuine accessories, expert repair services & mobile recharge.",
        footer_copyright:
          "© 2024 King Mobiles & Communications. All Rights Reserved.",
        footer_credits: "Made with <span>♥</span>",
      };
    case "hero-footer":
      return getFallbackData("shop-info");
    case "reviews":
      return { reviews: [] };
    case "gallery":
      return {
        cards: [
          {
            image:
              "assets/images/king-mobiles-and-communications-front-view.jpg",
            title: "Store Front — Uchipuli",
            heightClass: "h1",
          },
          {
            image:
              "assets/images/king-mobiles-and-communications-front-view.jpg",
            title: "Smartphone Showroom",
            heightClass: "h2",
          },
          { image: "", title: "Premium Accessories Rack", heightClass: "h3" },
          { image: "", title: "Expert Service Center", heightClass: "h2" },
          { image: "", title: "Friendly Customer Service", heightClass: "h4" },
        ],
      };
    case "offer-banner":
      return {
        enabled: true,
        items: [
          { text: "Weekend Offer — Accessories up to 20% Off" },
          { text: "Free Tempered Glass on all Screen Replacements" },
          { text: "Authorised dealer for Zebronics, Oraimo, Itel, HMD & more" },
          { text: "All products are 100% Original & Genuine" },
        ],
      };
    case "faq":
      return {
        slogan: "Everything you need to know before visiting us.",
        items: [],
      };
    default:
      return { slogan: "", cards: [] };
  }
}

// Render dynamic forms for editing
function renderEditPanel(tabName, data, container) {
  if (!container) return;
  container.innerHTML = "";

  if (tabName === "profile") {
    const currentUser = JSON.parse(
      sessionStorage.getItem("king_admin_user") || "{}",
    );
    const isAdmin = currentUser.isAdmin === true;

    let usersListHtml = "";
    if (isAdmin) {
      if (!data.users || data.users.length === 0) {
        usersListHtml = `
          <div style="text-align: center; padding: 25px; color: var(--gray); border: 1px dashed var(--glass-border); border-radius: var(--radius-sm); font-size: 0.85rem;">
            No other admin accounts created yet. Use the registration form below.
          </div>
        `;
      } else {
        usersListHtml = `<div class="items-list-container">`;
        data.users.forEach((u) => {
          const isSelf =
            u.username?.toLowerCase() === currentUser.username?.toLowerCase();
          const isMasterAdmin = u.username?.toLowerCase() === "admin";

          let deleteBtn = "";
          if (isSelf) {
            deleteBtn = `<span style="font-size: 0.75rem; color: var(--gold); font-weight: 600; font-style: italic;">Active Session</span>`;
          } else if (isMasterAdmin) {
            deleteBtn = `<span style="font-size: 0.75rem; color: var(--gold); font-weight: 600; font-style: italic;">Primary Superadmin</span>`;
          } else {
            deleteBtn = `
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-secondary" onclick="editUser('${u.username}')" style="padding: 6px 12px; font-size: 0.8rem; height: auto;">Edit</button>
                <button class="btn btn-danger" onclick="deleteUser('${u.username}')" style="padding: 6px 12px; font-size: 0.8rem; height: auto;">Revoke</button>
              </div>
            `;
          }

          usersListHtml += `
            <div class="item-row" style="padding: 12px 16px; background: rgba(255,255,255,0.01); border: 1px solid var(--glass-border); display: flex; align-items: center; justify-content: space-between;">
              <div class="item-details" style="display: flex; align-items: center; gap: 15px; flex: 1;">
                <div class="avatar-badge" style="width: 32px; height: 32px; font-size: 0.8rem; margin: 0; min-width: 32px;">${u.avatar || u.name?.substring(0, 2).toUpperCase() || "AD"}</div>
                <div style="text-align: left;">
                  <div class="item-name" style="font-size: 0.9rem; font-weight: 600; margin: 0; color: var(--white);">${u.name || u.username}</div>
                  <div class="item-subtext" style="font-size: 0.75rem; color: var(--gray); margin-top: 2px;">@${u.username} • ${u.role || "Administrator"} • ${u.isAdmin ? "Admin" : "Staff"}</div>
                </div>
              </div>
              <div class="item-actions" style="margin: 0; padding: 0;">
                ${deleteBtn}
              </div>
            </div>
          `;
        });
        usersListHtml += `</div>`;
      }
    }

    const myProfileFormHtml = `
      <form id="profile-details-form" onsubmit="saveMyProfile(event)" style="background: rgba(255, 255, 255, 0.01); padding: 20px; border: 1px solid var(--glass-border); border-radius: var(--radius);">
        <h3 style="color: var(--white); margin: 0 0 20px 0; font-size: 1.05rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 10px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px;">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width:18px;height:18px;color:var(--gold);"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
          My Profile Info ${!isAdmin ? '<span style="color: var(--gold); font-size: 0.75rem; margin-left: 10px; font-weight: 500;">(Staff User)</span>' : ""}
        </h3>
        <div class="form-group">
          <label class="form-label">Display Name</label>
          <input type="text" class="form-input" id="profile-name" value="${currentUser.name || "System Admin"}" required>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Role Title</label>
            <input type="text" class="form-input" id="profile-role" value="${currentUser.role || "Firestore Database Owner"}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Avatar Initials</label>
            <input type="text" class="form-input" id="profile-avatar" value="${currentUser.avatar || "AD"}" maxlength="2" required style="text-transform: uppercase;">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Username (Immutable)</label>
          <input type="text" class="form-input" id="profile-username" value="${currentUser.username || "admin"}" disabled style="opacity: 0.5; cursor: not-allowed; background: var(--dark);">
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Current Password</label>
            <input type="password" class="form-input" id="profile-current-password" placeholder="Verify current password">
          </div>
          <div class="form-group">
            <label class="form-label">New Password</label>
            <input type="password" class="form-input" id="profile-new-password" placeholder="Enter new password">
          </div>
        </div>
        <div class="actions-footer" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--glass-border);">
          <button type="submit" class="btn btn-save" id="btn-save-profile" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            Update Profile & Password
          </button>
        </div>
      </form>
    `;

    const userManagementFormHtml = `
      <form id="create-user-form" onsubmit="createNewUser(event)" style="background: rgba(255, 255, 255, 0.01); padding: 20px; border: 1px solid var(--glass-border); border-radius: var(--radius); margin-bottom: 25px;">
        <h3 id="create-user-form-title" style="color: var(--white); margin: 0 0 20px 0; font-size: 1.05rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 10px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px;">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width:18px;height:18px;color:var(--gold);"><path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
          Create Dashboard User
        </h3>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Login Username</label>
            <input type="text" class="form-input" id="new-user-username" placeholder="e.g. vijay" required style="text-transform: lowercase;">
          </div>
          <div class="form-group" id="new-user-password-container">
            <label class="form-label">Login Password</label>
            <input type="password" class="form-input" id="new-user-password" placeholder="••••••••••••" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Full Display Name</label>
          <input type="text" class="form-input" id="new-user-name" placeholder="e.g. Vijay Kumar" required>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Role Title</label>
            <input type="text" class="form-input" id="new-user-role" placeholder="e.g. Sales Manager" required>
          </div>
          <div class="form-group">
            <label class="form-label">Avatar (2 Chars)</label>
            <input type="text" class="form-input" id="new-user-avatar" placeholder="e.g. VK" maxlength="2" required style="text-transform: uppercase;">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Access Level</label>
          <select class="form-input" id="new-user-access" style="background-color: var(--dark3); border-color: var(--glass-border);">
            <option value="user">Regular User (Edit own profile only)</option>
            <option value="admin">Administrator (Full control)</option>
          </select>
        </div>
        <button type="submit" id="btn-create-user" class="btn btn-add" style="width: 100%; margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
          Add User to Database
        </button>
        <div id="cancel-edit-user-container"></div>
      </form>

      <h3 style="color: var(--white); margin: 0 0 15px 0; font-size: 1.05rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; display: flex; align-items: center; gap: 8px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--gold);"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        Database Users List
      </h3>
      ${usersListHtml}
    `;

    if (isAdmin) {
      container.innerHTML = `
        <div class="grid-2" style="align-items: start; gap: 30px;">
          <div>${myProfileFormHtml}</div>
          <div>${userManagementFormHtml}</div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div style="max-width: 600px; margin: 0 auto;">
          ${myProfileFormHtml}
        </div>
      `;
    }
    return;
  }

  if (tabName === "shop-info") {
    const currentUser = JSON.parse(
      sessionStorage.getItem("king_admin_user") || "{ }",
    );
    const isAdmin = currentUser.isAdmin === true;

    // Render Shop Info inputs
    container.innerHTML = `
      <form id="shop-info-form" onsubmit="saveShopInfo(event)">
        <h3 style="color: var(--white); margin: 0 0 15px 0; font-size: 1.1rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 8px;">
          Shop Contact & Address Settings ${!isAdmin ? '<span style="color: var(--red); font-size: 0.8rem; margin-left: 10px;">(Read-Only: Admin Access Required)</span>' : ""}
        </h3>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input type="text" class="form-input" id="shop-phone" value="${data.phone || ""}" placeholder="e.g. +91 73394 80350" required ${!isAdmin ? "disabled" : ""}>
          </div>
          <div class="form-group">
            <label class="form-label">WhatsApp Number</label>
            <input type="text" class="form-input" id="shop-whatsapp" value="${data.whatsapp || ""}" placeholder="e.g. +91 73394 80350" required ${!isAdmin ? "disabled" : ""}>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" class="form-input" id="shop-email" value="${data.mail || ""}" placeholder="e.g. kingmobiles@gmail.com" required ${!isAdmin ? "disabled" : ""}>
          </div>
          <div class="form-group">
            <label class="form-label">Business Hours Short Text (e.g. 9:00 AM – 9:30 PM)</label>
            <input type="text" class="form-input" id="shop-hours" value="${data.business_hours || ""}" placeholder="e.g. 9:00 AM – 9:30 PM" required ${!isAdmin ? "disabled" : ""}>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Weekdays Hours</label>
            <input type="text" class="form-input" id="shop-weekdays" value="${data.weekdays_timing || ""}" placeholder="e.g. 9 AM – 9.30 PM" required ${!isAdmin ? "disabled" : ""}>
          </div>
          <div class="form-group">
            <label class="form-label">Weekend Hours (Sunday)</label>
            <input type="text" class="form-input" id="shop-weekend" value="${data.weekend_timing || ""}" placeholder="e.g. 9 AM – 9.30 PM" required ${!isAdmin ? "disabled" : ""}>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Short Address (for sub-headings)</label>
          <input type="text" class="form-input" id="shop-short-address" value="${data.short_address || ""}" placeholder="ST Complex, Van stand Opp, Uchipuli" required ${!isAdmin ? "disabled" : ""}>
        </div>
        <div class="form-group">
          <label class="form-label">Full Address (Use semicolons ';' to break lines)</label>
          <textarea class="form-input" id="shop-address" placeholder="ST Complex, Van stand Opposite; Uchipuli, Ramanathapuram; Tamil Nadu — 623534" required ${!isAdmin ? "disabled" : ""}>${data.address || ""}</textarea>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Google Maps Embed Link (iframe src)</label>
            <input type="text" class="form-input" id="shop-map-pin" value="${data.map_pin_link || ""}" placeholder="e.g. https://www.google.com/maps/embed?pb=..." required ${!isAdmin ? "disabled" : ""}>
          </div>
          <div class="form-group">
            <label class="form-label">Google Maps Share Link</label>
            <input type="text" class="form-input" id="shop-map-share" value="${data.map_share_link || ""}" placeholder="e.g. https://maps.app.goo.gl/..." required ${!isAdmin ? "disabled" : ""}>
          </div>
        </div>
        ${
          isAdmin
            ? `
        <div class="actions-footer" style="margin-top: 30px;">
          <button type="submit" class="btn btn-save" id="btn-save-shop">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            Save Address & Contacts
          </button>
        </div>
        `
            : ""
        }
      </form>
      `;
    return;
  }

  if (tabName === "hero-footer") {
    const currentUser = JSON.parse(
      sessionStorage.getItem("king_admin_user") || "{ }",
    );
    const isAdmin = currentUser.isAdmin === true;

    // Render Hero & Footer inputs
    container.innerHTML = `
      <form id="hero-footer-form" onsubmit="saveHeroFooter(event)">
        <h3 style="color: var(--white); margin: 0 0 15px 0; font-size: 1.1rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 8px;">
          Hero Section Customization ${!isAdmin ? '<span style="color: var(--red); font-size: 0.8rem; margin-left: 10px;">(Read-Only: Admin Access Required)</span>' : ""}
        </h3>
        <div class="form-group">
          <label class="form-label">Hero Slogan / Subtitle Text</label>
          <textarea class="form-input" id="hero-slogan" required ${!isAdmin ? "disabled" : ""}>${data.hero_slogan || ""}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Hero Trust Tags (Comma-separated list)</label>
          <input type="text" class="form-input" id="hero-tags" value="${(data.hero_tags || []).join(", ")}" placeholder="Genuine Products, Official Brand Partner, Expert Service" ${!isAdmin ? "disabled" : ""}>
        </div>
        <div class="form-group">
          <label class="form-label" style="margin-bottom: 8px;">Hero Stats Counters</label>
          <div style="display: flex; flex-direction: column; gap: 10px;" id="hero-stats-container">
            ${(data.hero_stats || [])
              .map(
                (stat, idx) => `
              <div class="grid-3 hero-stat-row" style="gap: 10px; margin-bottom: 5px;">
                <input type="text" class="form-input stat-label" value="${stat.label}" placeholder="e.g. Years Experience" required ${!isAdmin ? "disabled" : ""}>
                <input type="number" class="form-input stat-value" value="${stat.value}" placeholder="e.g. 2" required ${!isAdmin ? "disabled" : ""}>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <input type="text" class="form-input stat-suffix" value="${stat.suffix || "+"}" placeholder="e.g. +" style="flex-grow: 1;" ${!isAdmin ? "disabled" : ""}>
                  ${isAdmin ? `<button type="button" class="btn btn-danger" onclick="this.closest('.hero-stat-row').remove()" style="padding: 10px; min-width: auto; height: 100%; display: flex; align-items: center; justify-content: center;">✕</button>` : ""}
                </div>
              </div>
            `,
              )
              .join("")}
          </div>
          ${isAdmin ? `<button type="button" class="btn btn-secondary" onclick="addHeroStatRow()" style="margin-top: 10px; font-size: 0.8rem; padding: 6px 12px;">+ Add Stat Counter</button>` : ""}
        </div>

        <h3 style="color: var(--white); margin: 30px 0 15px 0; font-size: 1.1rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 8px;">
          Footer Section Customization
        </h3>
        <div class="form-group">
          <label class="form-label">Footer Description Slogan</label>
          <textarea class="form-input" id="footer-slogan" required ${!isAdmin ? "disabled" : ""}>${data.footer_slogan || ""}</textarea>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Footer Copyright Text</label>
            <input type="text" class="form-input" id="footer-copyright" value="${data.footer_copyright || ""}" placeholder="e.g. © 2024 King Mobiles & Communications. All Rights Reserved." required ${!isAdmin ? "disabled" : ""}>
          </div>
          <div class="form-group">
            <label class="form-label">Footer Credits (e.g. Made with &lt;span&gt;♥&lt;/span&gt;)</label>
            <input type="text" class="form-input" id="footer-credits" value="${data.footer_credits || ""}" placeholder="e.g. Made with <span>♥</span>" required ${!isAdmin ? "disabled" : ""}>
          </div>
        </div>

        ${
          isAdmin
            ? `
        <div class="actions-footer" style="margin-top: 30px;">
          <button type="submit" class="btn btn-save" id="btn-save-hero-footer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            Save Hero & Footer Configurations
          </button>
        </div>
        `
            : ""
        }
      </form>
      `;
    return;
  }

  // For other collections, we typically have a section-level slogan, and a list of cards/items.
  let listHtml = "";
  const items = data.cards || data.items || data.services || data.reviews || [];

  if (items.length === 0) {
    listHtml = `
      <div style="text-align: center; padding: 40px; color: var(--gray); border: 1px dashed var(--glass-border); border-radius: var(--radius-sm); margin-bottom: 20px;">
         No items added yet. Click "+ Add New Item" to create one.
      </div>
    `;
  } else {
    listHtml = `<div class="items-list-container">`;
    items.forEach((item, index) => {
      let displayName =
        item.name ||
        item.title ||
        item.question ||
        item.text ||
        `Item ${index + 1}`;
      let subText =
        item.desc ||
        item.answer ||
        item.description ||
        (item.stars ? `${item.stars} - by ${item.name}` : "");
      if (tabName === "gallery") {
        subText = `Layout Height: ${item.heightClass || "none"} | Image: ${item.image ? (item.image.includes("drive.google.com") ? "Google Drive" : item.image) : "No Image (Text Placeholder)"}`;
      }

      // Clean display values
      if (displayName.length > 50)
        displayName = displayName.slice(0, 50) + "...";
      if (subText && subText.length > 80)
        subText = subText.slice(0, 80) + "...";

      // Status indicator for offers
      let statusBadge = "";
      if (tabName === "offers") {
        statusBadge =
          item.enabled !== false
            ? `<span class="item-badge active">Active</span>`
            : `<span class="item-badge disabled">Disabled</span>`;
      }

      listHtml += `
      <div class="item-row">
        <div class="item-details">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="item-name">${displayName}</span>
            ${statusBadge}
          </div>
          <span class="item-subtext">${subText || ""}</span>
        </div>
        <div class="item-actions" style="display: flex; gap: 6px;">
          <button class="btn btn-secondary btn-icon-only" onclick="moveItem('${tabName}', ${index}, 'up')" title="Move Up" ${index === 0 ? 'disabled style="opacity: 0.3;"' : ""} style="display: flex; align-items: center; justify-content: center;">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"></polyline></svg>
          </button>
          <button class="btn btn-secondary btn-icon-only" onclick="moveItem('${tabName}', ${index}, 'down')" title="Move Down" ${index === items.length - 1 ? 'disabled style="opacity: 0.3;"' : ""} style="display: flex; align-items: center; justify-content: center;">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <button class="btn btn-secondary btn-icon-only" onclick="openItemModal('${tabName}', ${index})" title="Edit Details" style="display: flex; align-items: center; justify-content: center;">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
          </button>
          <button class="btn btn-danger btn-icon-only" onclick="deleteItem('${tabName}', ${index})" title="Delete Item" style="display: flex; align-items: center; justify-content: center;">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>
      </div>
      `;
    });
    listHtml += `</div>`;
  }

  // Sections slogan if present
  let sloganGroup = "";
  if (data.hasOwnProperty("slogan")) {
    sloganGroup = `
      <div class="form-group">
        <label class="form-label">${tabName.toUpperCase()} Section Slogan / Subtitle</label>
        <input type="text" class="form-input" id="section-slogan" value="${data.slogan || ""}" placeholder="e.g. Explore our products collection" required>
      </div>
    `;
  }

  // Special services section-level defaults
  if (tabName === "services" && data.default) {
    const defaultImgVal =
      data.default.image || "assets/images/service_default.png";
    const isDefaultImgDrive = isDriveThumbnailUrl(defaultImgVal);
    const displayDefaultImg = isDefaultImgDrive
      ? extractDriveId(defaultImgVal)
      : defaultImgVal;

    sloganGroup = `
      <div style="margin-bottom: 24px; padding: 20px; background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); border-radius: var(--radius-sm);">
        <h4 style="margin-bottom: 15px; color: var(--gold); font-size: 0.95rem; font-weight: 700; text-transform: uppercase;">Repair Panel Defaults (No selection state)</h4>
        <div class="form-group">
          <label class="form-label">Default Title</label>
          <input type="text" class="form-input" id="service-default-title" value="${data.default.title || ""}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Default Description</label>
          <textarea class="form-input" id="service-default-desc" required>${data.default.description || ""}</textarea>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <label class="form-label" style="margin-bottom: 0;">Default Image Path</label>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.75rem; color: var(--gray-light); font-weight: 500;">Drive Image</span>
                <label class="switch">
                  <input type="checkbox" id="service-default-image-is-drive" ${isDefaultImgDrive ? "checked" : ""} onchange="document.getElementById('service-default-image').placeholder = this.checked ? 'Enter Google Drive URL or File ID' : 'assets/images/... or external URL'">
                  <span class="slider"></span>
                </label>
              </div>
            </div>
            <input type="text" class="form-input" id="service-default-image" value="${displayDefaultImg}" placeholder="${isDefaultImgDrive ? "Enter Google Drive URL or File ID" : "assets/images/... or external URL"}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Default WhatsApp Auto Message</label>
            <input type="text" class="form-input" id="service-default-wa" value="${data.default.waMessage || ""}" required>
          </div>
        </div>
      </div>
      `;
  }

  if (tabName === "offer-banner") {
    container.innerHTML = `
      <div style="margin-bottom: 24px; padding: 20px; background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between;">
        <div>
          <h4 style="color: var(--white); font-size: 0.95rem; font-weight: 700; text-transform: uppercase;">Banner Status</h4>
          <p style="font-size: 0.8rem; color: var(--gray); margin-top: 4px;">Turn the scrolling offer banner at the top of the website ON or OFF</p>
        </div>
        <label class="switch">
          <input type="checkbox" id="banner-status-toggle" ${data.enabled !== false ? "checked" : ""}>
          <span class="slider"></span>
        </label>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin: 20px 0 15px 0;">
        <h3 style="font-size: 1rem; font-weight: 700; color: var(--white); text-transform: uppercase; letter-spacing: 0.02em;">Ticker Text Items (${items.length})</h3>
        <button class="btn btn-add" onclick="openItemModal('${tabName}', null)" style="display: flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Ticker Item
        </button>
      </div>
      
      ${listHtml}

    <div class="actions-footer">
      <button class="btn btn-save" onclick="saveCollectionChanges('${tabName}')" id="btn-save-collection">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
        Save All Changes
      </button>
    </div>
    `;
    return;
  }

  container.innerHTML = `
    ${sloganGroup}
    <div style="display: flex; justify-content: space-between; align-items: center; margin: 20px 0 15px 0;">
      <h3 style="font-size: 1rem; font-weight: 700; color: var(--white); text-transform: uppercase; letter-spacing: 0.02em;">Items (${items.length})</h3>
      <button class="btn btn-add" onclick="openItemModal('${tabName}', null)" style="display: flex; align-items: center; gap: 6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Add New Item
      </button>
    </div>
    
    ${listHtml}

    <div class="actions-footer">
      <button class="btn btn-save" onclick="saveCollectionChanges('${tabName}')" id="btn-save-collection">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
        Save All Changes
      </button>
    </div>
    `;
}

// Add a new row to stats counters in the editor UI
window.addHeroStatRow = function () {
  const container = document.getElementById("hero-stats-container");
  if (!container) return;

  const row = document.createElement("div");
  row.className = "grid-3 hero-stat-row";
  row.style.cssText = "gap: 10px; margin-bottom: 5px;";
  row.innerHTML = `
    <input type="text" class="form-input stat-label" placeholder="e.g. Years Experience" required>
    <input type="number" class="form-input stat-value" placeholder="e.g. 2" required>
    <div style="display: flex; gap: 8px; align-items: center;">
      <input type="text" class="form-input stat-suffix" value="+" placeholder="e.g. +" style="flex-grow: 1;">
      <button type="button" class="btn btn-danger" onclick="this.closest('.hero-stat-row').remove()" style="padding: 10px; min-width: auto; height: 100%; display: flex; align-items: center; justify-content: center;">✕</button>
    </div>
  `;
  container.appendChild(row);
};

// Save Shop Contact details back to Firebase (preserving hero/footer configurations)
window.saveShopInfo = async function (e) {
  e.preventDefault();

  const saveBtn = document.getElementById("btn-save-shop");
  const originalHtml = saveBtn.innerHTML;
  saveBtn.disabled = true;
  saveBtn.innerHTML = `<span class="spinner"></span> Saving...`;

  const currentData =
    localDataStore["shop-info"] ||
    localDataStore["hero-footer"] ||
    getFallbackData("shop-info");

  const updatedData = {
    ...currentData,
    phone: document.getElementById("shop-phone").value.trim(),
    whatsapp: document.getElementById("shop-whatsapp").value.trim(),
    mail: document.getElementById("shop-email").value.trim(),
    business_hours: document.getElementById("shop-hours").value.trim(),
    weekdays_timing: document.getElementById("shop-weekdays").value.trim(),
    weekend_timing: document.getElementById("shop-weekend").value.trim(),
    short_address: document.getElementById("shop-short-address").value.trim(),
    address: document.getElementById("shop-address").value.trim(),
    map_pin_link: document.getElementById("shop-map-pin").value.trim(),
    map_share_link: document.getElementById("shop-map-share").value.trim(),
  };

  try {
    const docRef = doc(db, "shop-info", "base-info");
    await setDoc(docRef, updatedData);

    // Update local store copies
    localDataStore["shop-info"] = updatedData;
    localDataStore["hero-footer"] = updatedData;
    showToast(
      "Shop Info Saved",
      "Contact and address details successfully updated.",
    );
  } catch (error) {
    console.error("Firestore save error:", error);
    showToast("Save Failed", "Could not sync details with Firebase.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalHtml;
  }
};

// Save Hero & Footer configurations back to Firebase (preserving contact/address details)
window.saveHeroFooter = async function (e) {
  e.preventDefault();

  const saveBtn = document.getElementById("btn-save-hero-footer");
  const originalHtml = saveBtn.innerHTML;
  saveBtn.disabled = true;
  saveBtn.innerHTML = `<span class="spinner"></span> Saving...`;

  // Parse Hero Stats
  const statRows = document.querySelectorAll(".hero-stat-row");
  const heroStats = Array.from(statRows).map((row) => {
    return {
      label: row.querySelector(".stat-label").value.trim(),
      value: parseInt(row.querySelector(".stat-value").value) || 0,
      suffix: row.querySelector(".stat-suffix").value.trim(),
    };
  });

  // Parse Hero Tags
  const tagsInput = document.getElementById("hero-tags").value.trim();
  const heroTags = tagsInput
    ? tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => !!t)
    : [];

  const currentData =
    localDataStore["hero-footer"] ||
    localDataStore["shop-info"] ||
    getFallbackData("shop-info");

  const updatedData = {
    ...currentData,
    hero_slogan: document.getElementById("hero-slogan").value.trim(),
    hero_tags: heroTags,
    hero_stats: heroStats,
    footer_slogan: document.getElementById("footer-slogan").value.trim(),
    footer_copyright: document.getElementById("footer-copyright").value.trim(),
    footer_credits: document.getElementById("footer-credits").value.trim(),
  };

  try {
    const docRef = doc(db, "shop-info", "base-info");
    await setDoc(docRef, updatedData);

    // Update local store copies
    localDataStore["shop-info"] = updatedData;
    localDataStore["hero-footer"] = updatedData;
    showToast(
      "Hero & Footer Saved",
      "Hero and footer configurations successfully updated.",
    );
  } catch (error) {
    console.error("Firestore save error:", error);
    showToast("Save Failed", "Could not sync details with Firebase.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalHtml;
  }
};

// Reorder array items (Move Up/Down)
window.moveItem = function (tabName, index, direction) {
  const data = localDataStore[tabName];
  const items = data.cards || data.items || data.services || data.reviews || [];

  if (direction === "up" && index > 0) {
    const temp = items[index];
    items[index] = items[index - 1];
    items[index - 1] = temp;
  } else if (direction === "down" && index < items.length - 1) {
    const temp = items[index];
    items[index] = items[index + 1];
    items[index + 1] = temp;
  }

  // Re-render
  const container = document
    .getElementById(`${tabName}-panel`)
    .querySelector(".panel-content-body");
  renderEditPanel(tabName, data, container);
};

// Delete item from local array
window.deleteItem = function (tabName, index) {
  if (
    !confirm(
      "Are you sure you want to delete this item? Don't forget to click 'Save All Changes' to apply it globally.",
    )
  ) {
    return;
  }

  const data = localDataStore[tabName];
  const items = data.cards || data.items || data.services || data.reviews || [];
  items.splice(index, 1);

  // Re-render
  const container = document
    .getElementById(`${tabName}-panel`)
    .querySelector(".panel-content-body");
  renderEditPanel(tabName, data, container);
  showToast(
    "Item Deleted Locally",
    "The item has been removed from your local draft.",
  );
};

// Upload section contents to Firebase website collection
window.saveCollectionChanges = async function (tabName) {
  const saveBtn = document.getElementById("btn-save-collection");
  const originalHtml = saveBtn.innerHTML;
  saveBtn.disabled = true;
  saveBtn.innerHTML = `<span class="spinner"></span> Uploading...`;

  const docData = localDataStore[tabName];

  // Capture section level modifications from inputs if they exist
  const sloganInput = document.getElementById("section-slogan");
  if (sloganInput) {
    docData.slogan = sloganInput.value.trim();
  }

  // Capture status toggle for offer-banner
  if (tabName === "offer-banner") {
    const statusToggle = document.getElementById("banner-status-toggle");
    if (statusToggle) {
      docData.enabled = statusToggle.checked;
    }
  }

  // Compile sliding_images from cards for partners tab
  if (tabName === "partners") {
    const items = docData.cards || [];
    docData.sliding_images = items
      .map((item) => item.sliderImage)
      .filter((url) => !!url);
  }

  // Capture defaults for services
  if (tabName === "services") {
    let defaultImage = document
      .getElementById("service-default-image")
      .value.trim();
    const isDrive = document.getElementById(
      "service-default-image-is-drive",
    )?.checked;
    if (isDrive) {
      const driveId = extractDriveId(defaultImage);
      if (driveId) {
        defaultImage = `https://drive.google.com/thumbnail?id=${driveId}&sz=w2000`;
      }
    }
    docData.default = {
      title: document.getElementById("service-default-title").value.trim(),
      description: document.getElementById("service-default-desc").value.trim(),
      image: defaultImage,
      waMessage: document.getElementById("service-default-wa").value.trim(),
      showBadges: docData.default?.showBadges || false,
    };
  }

  try {
    const docRef = doc(db, "website", tabName);
    await setDoc(docRef, docData);
    showToast(
      "Changes Saved",
      `${tabName.toUpperCase()} section updated successfully.`,
    );
  } catch (error) {
    console.error("Firestore sync error:", error);
    showToast("Sync Error", `Could not update ${tabName}.`, "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalHtml;
  }
};

/* ==========================================================================
   Item Editor Modal
   ========================================================================== */
window.openItemModal = function (tabName, index) {
  editingItemIndex = index;
  const modal = document.getElementById("item-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");

  modalTitle.textContent =
    index === null ? `Add New Item` : `Edit Item Properties`;
  modalBody.innerHTML = "";

  const data = localDataStore[tabName];
  const items = data.cards || data.items || data.services || data.reviews || [];
  const item = index !== null ? items[index] : getNewItemTemplate(tabName);

  // Generate dynamic modal form fields based on tab requirements
  let formFields = "";

  switch (tabName) {
    case "why":
      formFields = `
          <div class="form-group">
            <label class="form-label">Card Title</label>
            <input type="text" class="form-input" id="m-why-title" value="${item.title || ""}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Card Description</label>
            <textarea class="form-input" id="m-why-desc" required>${item.desc || ""}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">SVG Icon String</label>
            <textarea class="form-input" id="m-why-icon" placeholder='<svg viewBox="0 0 24 24" ...>...</svg>' required>${item.icon || ""}</textarea>
          </div>
          `;
      break;

    case "services": {
      const servImgVal = item.image || "assets/images/service_default.png";
      const isServImgDrive = isDriveThumbnailUrl(servImgVal);
      const displayServImg = isServImgDrive
        ? extractDriveId(servImgVal)
        : servImgVal;
      formFields = `
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Service ID (Unique, e.g. repair, screen)</label>
              <input type="text" class="form-input" id="m-serv-id" value="${item.id || ""}" placeholder="e.g. glass" ${index !== null ? "disabled" : ""} required>
            </div>
            <div class="form-group">
              <label class="form-label">Service List Name</label>
              <input type="text" class="form-input" id="m-serv-name" value="${item.name || ""}" placeholder="e.g. Tempered Glass" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Detailed Title</label>
            <input type="text" class="form-input" id="m-serv-title" value="${item.title || ""}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Service Description</label>
            <textarea class="form-input" id="m-serv-desc" required>${item.description || ""}</textarea>
          </div>
          <div class="form-group">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <label class="form-label" style="margin-bottom: 0;">Image Path / URL</label>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.75rem; color: var(--gray-light); font-weight: 500;">Drive Image</span>
                <label class="switch">
                  <input type="checkbox" id="m-serv-image-is-drive" ${isServImgDrive ? "checked" : ""} onchange="document.getElementById('m-serv-image').placeholder = this.checked ? 'Enter Google Drive URL or File ID' : 'assets/images/... or external URL'">
                    <span class="slider"></span>
                </label>
              </div>
            </div>
            <input type="text" class="form-input" id="m-serv-image" value="${displayServImg}" placeholder="${isServImgDrive ? "Enter Google Drive URL or File ID" : "assets/images/... or external URL"}" required>
          </div>
          <div class="form-group">
            <label class="form-label">WhatsApp Contact Preset Message</label>
            <input type="text" class="form-input" id="m-serv-wa" value="${item.waMessage || ""}" required>
          </div>
          <div class="form-group" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0;">
            <label class="form-label" style="margin-bottom: 0;">Show Brand Badges (Airtel, Jio, Vi)</label>
            <label class="switch">
              <input type="checkbox" id="m-serv-badges" ${item.showBadges ? "checked" : ""}>
                <span class="slider"></span>
            </label>
          </div>
          `;
      break;
    }

    case "offers":
      formFields = `
          <div class="grid-3" style="display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 15px; margin-bottom: 15px;">
            <div class="form-group">
              <label class="form-label">Offer ID (Unique Code)</label>
              <input type="text" class="form-input" id="m-off-id" value="${item.id || ""}" placeholder="e.g. cd4" ${index !== null ? "disabled" : ""} required>
            </div>
            <div class="form-group">
              <label class="form-label">Offer Title</label>
              <input type="text" class="form-input" id="m-off-title" value="${item.title || ""}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Display Mode</label>
              <select class="form-input" id="m-off-type" style="background-color: var(--dark3); color: var(--white); border: 1px solid rgba(255, 255, 255, 0.08); font-family: inherit;">
                <option value="standard" ${item.type === "standard" || !item.type ? "selected" : ""}>Ticking Countdown</option>
                <option value="year_round" ${item.type === "year_round" ? "selected" : ""}>Year-Round / Annual Sale</option>
                <option value="seasonal" ${item.type === "seasonal" ? "selected" : ""}>Seasonal / Monthly Offer</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Offer Description</label>
            <textarea class="form-input" id="m-off-desc" required>${item.desc || ""}</textarea>
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Badge Name</label>
              <input type="text" class="form-input" id="m-off-badge" value="${item.badge || ""}" placeholder="e.g. Limited Time">
            </div>
            <div class="form-group">
              <label class="form-label">Badge Styling Class (e.g. 'hot' for orange/gold)</label>
              <input type="text" class="form-input" id="m-off-class" value="${item.badgeClass || ""}" placeholder="e.g. hot">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Expiration Date-Time</label>
            <input type="datetime-local" class="form-input" id="m-off-expires" value="${formatDateTimeLocal(item.expiresAt)}" required>
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">WhatsApp Preset Message</label>
              <input type="text" class="form-input" id="m-off-wa" value="${item.waText || ""}" required>
            </div>
            <div class="form-group">
              <label class="form-label">WhatsApp Button text</label>
              <input type="text" class="form-input" id="m-off-wabtn" value="${item.waBtnText || "Avail Offer"}" required>
            </div>
          </div>
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); padding: 12px 16px; margin-top: 15px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <label class="form-label" style="margin-bottom: 0;">Show Fire Emoji 🔥</label>
              <label class="switch">
                <input type="checkbox" id="m-off-fire" ${item.fire ? "checked" : ""}>
                  <span class="slider"></span>
              </label>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <label class="form-label" style="margin-bottom: 0;">Show Date Count (DAYS/HRS/MIN mode)</label>
              <label class="switch">
                <input type="checkbox" id="m-off-show-date-count" ${item.showDateCount ? "checked" : ""}>
                  <span class="slider"></span>
              </label>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <label class="form-label" style="margin-bottom: 0;">Show Target End Date (Text display)</label>
              <label class="switch">
                <input type="checkbox" id="m-off-showend" ${item.showEndDate ? "checked" : ""}>
                  <span class="slider"></span>
              </label>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <label class="form-label" style="margin-bottom: 0;">Enable Offer (If unchecked, won't show)</label>
              <label class="switch">
                <input type="checkbox" id="m-off-enabled" ${item.enabled !== false ? "checked" : ""}>
                  <span class="slider"></span>
              </label>
            </div>
          </div>
          `;
      break;

    case "partners": {
      const partLogoVal = item.logo || "";
      const isPartLogoDrive = isDriveThumbnailUrl(partLogoVal);
      const displayPartLogo = isPartLogoDrive
        ? extractDriveId(partLogoVal)
        : partLogoVal;

      const partSliderVal = item.sliderImage || "";
      const isPartSliderDrive = isDriveThumbnailUrl(partSliderVal);
      const displayPartSlider = isPartSliderDrive
        ? extractDriveId(partSliderVal)
        : partSliderVal;

      formFields = `
          <div class="form-group">
            <label class="form-label">Partner Brand Name</label>
            <input type="text" class="form-input" id="m-part-name" value="${item.name || ""}" required>
          </div>
          <div class="form-group">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <label class="form-label" style="margin-bottom: 0;">Brand Logo Path (White/Transparent PNG recommended)</label>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.75rem; color: var(--gray-light); font-weight: 500;">Drive Image</span>
                <label class="switch">
                  <input type="checkbox" id="m-part-logo-is-drive" ${isPartLogoDrive ? "checked" : ""} onchange="document.getElementById('m-part-logo').placeholder = this.checked ? 'Enter Google Drive URL or File ID' : 'assets/images/... or external URL'">
                    <span class="slider"></span>
                </label>
              </div>
            </div>
            <input type="text" class="form-input" id="m-part-logo" value="${displayPartLogo}" placeholder="${isPartLogoDrive ? "Enter Google Drive URL or File ID" : "assets/images/... or external URL"}" required>
          </div>
          <div class="form-group">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <label class="form-label" style="margin-bottom: 0;">Slider Image Path (Optional horizontal logo)</label>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.75rem; color: var(--gray-light); font-weight: 500;">Drive Image</span>
                <label class="switch">
                  <input type="checkbox" id="m-part-slider-is-drive" ${isPartSliderDrive ? "checked" : ""} onchange="document.getElementById('m-part-slider').placeholder = this.checked ? 'Enter Google Drive URL or File ID' : 'assets/images/... or external URL'">
                    <span class="slider"></span>
                </label>
              </div>
            </div>
            <input type="text" class="form-input" id="m-part-slider" value="${displayPartSlider}" placeholder="${isPartSliderDrive ? "Enter Google Drive URL or File ID" : "assets/images/... or external URL"}">
          </div>
          <div class="form-group">
            <label class="form-label">Partnership Badge</label>
            <input type="text" class="form-input" id="m-part-badge" value="${item.badge || "Official Partner"}" required>
          </div>
          `;
      break;
    }

    case "products":
      formFields = `
          <div class="form-group">
            <label class="form-label">Product Name</label>
            <input type="text" class="form-input" id="m-prod-name" value="${item.name || ""}" placeholder="e.g. Smartphones" required>
          </div>
          <div class="form-group">
            <label class="form-label">Product Description</label>
            <input type="text" class="form-input" id="m-prod-desc" value="${item.desc || ""}" placeholder="e.g. Budget to flagship options" required>
          </div>
          <div class="form-group">
            <label class="form-label">SVG Outline Icon String</label>
            <textarea class="form-input" id="m-prod-icon" placeholder='<svg viewBox="0 0 24 24" ...>...</svg>' required>${item.icon || ""}</textarea>
          </div>
          `;
      break;

    case "accessories": {
      const accImgVal = item.image || "";
      const isAccImgDrive = isDriveThumbnailUrl(accImgVal);
      const displayAccImg = isAccImgDrive
        ? extractDriveId(accImgVal)
        : accImgVal;
      formFields = `
          <div class="form-group">
            <label class="form-label">Accessory Name</label>
            <input type="text" class="form-input" id="m-acc-name" value="${item.name || ""}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Accessory Description</label>
            <textarea class="form-input" id="m-acc-desc" required>${item.desc || ""}</textarea>
          </div>
          <div class="form-group">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <label class="form-label" style="margin-bottom: 0;">Image Path / URL</label>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.75rem; color: var(--gray-light); font-weight: 500;">Drive Image</span>
                <label class="switch">
                  <input type="checkbox" id="m-acc-image-is-drive" ${isAccImgDrive ? "checked" : ""} onchange="document.getElementById('m-acc-image').placeholder = this.checked ? 'Enter Google Drive URL or File ID' : 'assets/images/... or external URL'">
                    <span class="slider"></span>
                </label>
              </div>
            </div>
            <input type="text" class="form-input" id="m-acc-image" value="${displayAccImg}" placeholder="${isAccImgDrive ? "Enter Google Drive URL or File ID" : "assets/images/... or external URL"}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Image Alt Tag (SEO)</label>
            <input type="text" class="form-input" id="m-acc-alt" value="${item.alt || ""}" required>
          </div>
          <div class="form-group">
            <label class="form-label">WhatsApp Enquiry Preset Text</label>
            <input type="text" class="form-input" id="m-acc-wa" value="${item.waText || ""}" required>
          </div>
          `;
      break;
    }

    case "gallery": {
      const gallImgVal = item.image || "";
      const isGallImgDrive = isDriveThumbnailUrl(gallImgVal);
      const displayGallImg = isGallImgDrive
        ? extractDriveId(gallImgVal)
        : gallImgVal;
      formFields = `
          <div class="form-group">
            <label class="form-label">Image Label / Title</label>
            <input type="text" class="form-input" id="m-gall-title" value="${item.title || ""}" placeholder="e.g. Store Front — Uchipuli" required>
          </div>
          <div class="form-group">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <label class="form-label" style="margin-bottom: 0;">Image Path / URL (Optional)</label>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.75rem; color: var(--gray-light); font-weight: 500;">Drive Image</span>
                <label class="switch">
                  <input type="checkbox" id="m-gall-image-is-drive" ${isGallImgDrive ? "checked" : ""} onchange="document.getElementById('m-gall-image').placeholder = this.checked ? 'Enter Google Drive URL or File ID' : 'assets/images/... or external URL'">
                    <span class="slider"></span>
                </label>
              </div>
            </div>
            <input type="text" class="form-input" id="m-gall-image" value="${displayGallImg}" placeholder="${isGallImgDrive ? "Enter Google Drive URL or File ID" : "assets/images/... or external URL"}">
          </div>
          <div class="form-group">
            <label class="form-label">Layout Height Class (for Masonry Grid)</label>
            <select class="form-input" id="m-gall-height" style="background-color: var(--dark3); border-color: var(--glass-border);">
              <option value="h1" ${item.heightClass === "h1" ? "selected" : ""}>h1 (Taller - fits 1st slot spanning 2 rows)</option>
              <option value="h2" ${item.heightClass === "h2" ? "selected" : ""}>h2 (Medium - fits 2nd & 4th slots)</option>
              <option value="h3" ${item.heightClass === "h3" ? "selected" : ""}>h3 (Short - fits 3rd slot)</option>
              <option value="h4" ${item.heightClass === "h4" ? "selected" : ""}>h4 (Extra Short - fits 5th slot)</option>
            </select>
          </div>
          `;
      break;
    }

    case "offer-banner":
      formFields = `
          <div class="form-group">
            <label class="form-label">Ticker Text</label>
            <input type="text" class="form-input" id="m-ticker-text" value="${item.text || ""}" placeholder="e.g. Special Discount 10% Off!" required>
          </div>
          `;
      break;

    case "reviews":
      formFields = `
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Customer Name</label>
              <input type="text" class="form-input" id="m-rev-name" value="${item.name || ""}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Avatar Initials (2 Chars max)</label>
              <input type="text" class="form-input" id="m-rev-avatar" value="${item.avatar || ""}" maxlength="2" required>
            </div>
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Stars Rating</label>
              <select class="form-input" id="m-rev-stars" style="background-color: var(--dark3); border-color: var(--glass-border);">
                <option value="★★★★★" ${item.stars === "★★★★★" ? "selected" : ""}>★★★★★ (5 Stars)</option>
                <option value="★★★★" ${item.stars === "★★★★" ? "selected" : ""}>★★★★ (4 Stars)</option>
                <option value="★★★" ${item.stars === "★★★" ? "selected" : ""}>★★★ (3 Stars)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Verification Subtext</label>
              <input type="text" class="form-input" id="m-rev-verified" value="${item.verified || "✓ Verified Customer"}" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Customer Review Text</label>
            <textarea class="form-input" id="m-rev-text" required>${item.text || ""}</textarea>
          </div>
          `;
      break;

    case "faq":
      formFields = `
          <div class="form-group">
            <label class="form-label">Question</label>
            <input type="text" class="form-input" id="m-faq-q" value="${item.question || ""}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Answer Text</label>
            <textarea class="form-input" id="m-faq-a" required>${item.answer || ""}</textarea>
          </div>
          `;
      break;
  }

  modalBody.innerHTML = `
          <form id="modal-item-form" onsubmit="saveItemProperties(event, '${tabName}')">
            ${formFields}
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="closeItemModal()">Cancel</button>
              <button type="submit" class="btn btn-save">Apply Settings</button>
            </div>
          </form>
          `;

  modal.classList.add("show");
};

// Item templates for new list additions
function getNewItemTemplate(tabName) {
  switch (tabName) {
    case "why":
      return { title: "", desc: "", icon: "" };
    case "services":
      return {
        id: "",
        name: "",
        title: "",
        description: "",
        image: "assets/images/service_default.png",
        waMessage: "",
        showBadges: false,
      };
    case "offers":
      return {
        id: `cd_${Date.now()}`,
        fire: false,
        type: "standard",
        showDateCount: false,
        badge: "Limited Time",
        badgeClass: "",
        title: "",
        desc: "",
        expiresAt: new Date(Date.now() + 86400000 * 3).toISOString(),
        showEndDate: false,
        enabled: true,
        waText: "",
        waBtnText: "Avail Offer",
      };
    case "partners":
      return { name: "", logo: "", sliderImage: "", badge: "Official Partner" };
    case "products":
      return { name: "", desc: "", icon: "" };
    case "accessories":
      return { name: "", desc: "", image: "", alt: "", waText: "" };
    case "reviews":
      return {
        stars: "★★★★★",
        text: "",
        avatar: "",
        name: "",
        verified: "✓ Verified Customer",
      };
    case "gallery":
      return { title: "", image: "", heightClass: "h2" };
    case "offer-banner":
      return { text: "" };
    case "faq":
      return { question: "", answer: "" };
    default:
      return {};
  }
}

// Close Editor Modal
window.closeItemModal = function () {
  const modal = document.getElementById("item-modal");
  modal.classList.remove("show");
};

// Update local array store when Modal Form is submitted
window.saveItemProperties = function (e, tabName) {
  e.preventDefault();

  const data = localDataStore[tabName];
  const items = data.cards || data.items || data.services || data.reviews || [];

  let item = {};

  switch (tabName) {
    case "why":
      item = {
        title: document.getElementById("m-why-title").value.trim(),
        desc: document.getElementById("m-why-desc").value.trim(),
        icon: document.getElementById("m-why-icon").value.trim(),
      };
      break;
    case "services": {
      let servImg = document.getElementById("m-serv-image").value.trim();
      const isServImgDrive = document.getElementById(
        "m-serv-image-is-drive",
      )?.checked;
      if (isServImgDrive) {
        const driveId = extractDriveId(servImg);
        if (driveId) {
          servImg = `https://drive.google.com/thumbnail?id=${driveId}&sz=w2000`;
        }
      }
      item = {
        id: document
          .getElementById("m-serv-id")
          .value.trim()
          .toLowerCase()
          .replace(/\s+/g, "-"),
        name: document.getElementById("m-serv-name").value.trim(),
        title: document.getElementById("m-serv-title").value.trim(),
        description: document.getElementById("m-serv-desc").value.trim(),
        image: servImg,
        waMessage: document.getElementById("m-serv-wa").value.trim(),
        showBadges: document.getElementById("m-serv-badges").checked,
      };
      break;
    }
    case "offers": {
      const expiresInput = document.getElementById("m-off-expires").value;
      const expiresIso = expiresInput
        ? new Date(expiresInput).toISOString()
        : "";
      item = {
        id: document
          .getElementById("m-off-id")
          .value.trim()
          .toLowerCase()
          .replace(/\s+/g, "-"),
        title: document.getElementById("m-off-title").value.trim(),
        type: document.getElementById("m-off-type").value,
        desc: document.getElementById("m-off-desc").value.trim(),
        badge: document.getElementById("m-off-badge").value.trim(),
        badgeClass: document.getElementById("m-off-class").value.trim(),
        expiresAt: expiresIso,
        waText: document.getElementById("m-off-wa").value.trim(),
        waBtnText: document.getElementById("m-off-wabtn").value.trim(),
        fire: document.getElementById("m-off-fire").checked,
        showDateCount: document.getElementById("m-off-show-date-count").checked,
        showEndDate: document.getElementById("m-off-showend").checked,
        enabled: document.getElementById("m-off-enabled").checked,
      };
      break;
    }
    case "partners": {
      let partLogo = document.getElementById("m-part-logo").value.trim();
      const isPartLogoDrive = document.getElementById(
        "m-part-logo-is-drive",
      )?.checked;
      if (isPartLogoDrive) {
        const driveId = extractDriveId(partLogo);
        if (driveId) {
          partLogo = `https://drive.google.com/thumbnail?id=${driveId}&sz=w2000`;
        }
      }

      let partSlider = document.getElementById("m-part-slider").value.trim();
      const isPartSliderDrive = document.getElementById(
        "m-part-slider-is-drive",
      )?.checked;
      if (isPartSliderDrive) {
        const driveId = extractDriveId(partSlider);
        if (driveId) {
          partSlider = `https://drive.google.com/thumbnail?id=${driveId}&sz=w2000`;
        }
      }

      item = {
        name: document.getElementById("m-part-name").value.trim(),
        logo: partLogo,
        sliderImage: partSlider,
        badge: document.getElementById("m-part-badge").value.trim(),
      };
      break;
    }
    case "products":
      item = {
        name: document.getElementById("m-prod-name").value.trim(),
        desc: document.getElementById("m-prod-desc").value.trim(),
        icon: document.getElementById("m-prod-icon").value.trim(),
      };
      break;
    case "accessories": {
      let accImg = document.getElementById("m-acc-image").value.trim();
      const isAccImgDrive = document.getElementById(
        "m-acc-image-is-drive",
      )?.checked;
      if (isAccImgDrive) {
        const driveId = extractDriveId(accImg);
        if (driveId) {
          accImg = `https://drive.google.com/thumbnail?id=${driveId}&sz=w2000`;
        }
      }
      item = {
        name: document.getElementById("m-acc-name").value.trim(),
        desc: document.getElementById("m-acc-desc").value.trim(),
        image: accImg,
        alt: document.getElementById("m-acc-alt").value.trim(),
        waText: document.getElementById("m-acc-wa").value.trim(),
      };
      break;
    }
    case "gallery": {
      let gallImg = document.getElementById("m-gall-image").value.trim();
      const isGallImgDrive = document.getElementById(
        "m-gall-image-is-drive",
      )?.checked;
      if (isGallImgDrive) {
        const driveId = extractDriveId(gallImg);
        if (driveId) {
          gallImg = `https://drive.google.com/thumbnail?id=${driveId}&sz=w2000`;
        }
      }
      item = {
        title: document.getElementById("m-gall-title").value.trim(),
        image: gallImg,
        heightClass: document.getElementById("m-gall-height").value,
      };
      break;
    }
    case "offer-banner":
      item = {
        text: document.getElementById("m-ticker-text").value.trim(),
      };
      break;
    case "reviews":
      item = {
        name: document.getElementById("m-rev-name").value.trim(),
        avatar: document
          .getElementById("m-rev-avatar")
          .value.trim()
          .toUpperCase(),
        stars: document.getElementById("m-rev-stars").value,
        verified: document.getElementById("m-rev-verified").value.trim(),
        text: document.getElementById("m-rev-text").value.trim(),
      };
      break;
    case "faq":
      item = {
        question: document.getElementById("m-faq-q").value.trim(),
        answer: document.getElementById("m-faq-a").value.trim(),
      };
      break;
  }

  // Update or append
  if (editingItemIndex !== null) {
    items[editingItemIndex] = item;
    showToast("Item Updated", "Properties updated in local draft.");
  } else {
    items.push(item);
    showToast("Item Added", "New item appended to local draft list.");
  }

  // Save back references to local state database object
  if (data.cards) data.cards = items;
  else if (data.items) data.items = items;
  else if (data.services) data.services = items;
  else if (data.reviews) data.reviews = items;

  closeItemModal();

  // Re-render dashboard
  const container = document
    .getElementById(`${tabName}-panel`)
    .querySelector(".panel-content-body");
  renderEditPanel(tabName, data, container);
};

// Save My Profile Info
window.saveMyProfile = async function (e) {
  e.preventDefault();

  const saveBtn = document.getElementById("btn-save-profile");
  const originalHtml = saveBtn.innerHTML;
  saveBtn.disabled = true;
  saveBtn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Saving...`;

  const currentUser = JSON.parse(
    sessionStorage.getItem("king_admin_user") || "{ }",
  );
  const username = currentUser.username || "admin";

  const currentPasswordVal = document.getElementById(
    "profile-current-password",
  ).value;
  const newPasswordVal = document.getElementById("profile-new-password").value;

  let passwordHash = currentUser.password; // Keep old password by default

  if (newPasswordVal) {
    if (!currentPasswordVal) {
      showToast(
        "Verification Required",
        "Please enter your current password to set a new password.",
        "error",
      );
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalHtml;
      return;
    }

    const enteredCurrentHash = await hashPassword(currentPasswordVal);
    // Compare enteredCurrentHash with stored hash, or fallback to plaintext comparison
    if (
      currentUser.password !== enteredCurrentHash &&
      currentUser.password !== currentPasswordVal
    ) {
      showToast(
        "Verification Failed",
        "The current password you entered is incorrect.",
        "error",
      );
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalHtml;
      return;
    }

    // Set new password hash
    passwordHash = await hashPassword(newPasswordVal);
  }

  const updatedUser = {
    username: username,
    password: passwordHash,
    name: document.getElementById("profile-name").value.trim(),
    role: document.getElementById("profile-role").value.trim(),
    avatar: document
      .getElementById("profile-avatar")
      .value.trim()
      .toUpperCase(),
    isAdmin:
      username.toLowerCase() === "admin" ? true : currentUser.isAdmin === true,
  };

  try {
    const docRef = doc(db, "users", username.toLowerCase());
    await setDoc(docRef, updatedUser);

    sessionStorage.setItem("king_admin_user", JSON.stringify(updatedUser));
    updateHeaderProfileUI(updatedUser);

    showToast(
      "Profile Updated",
      "Your profile details have been successfully saved.",
    );
    loadTab("profile");
  } catch (error) {
    console.error("Profile save error:", error);
    showToast(
      "Save Failed",
      "Could not sync profile details with Firebase.",
      "error",
    );
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalHtml;
  }
};

// Create or Update a Dashboard User
window.createNewUser = async function (e) {
  e.preventDefault();

  const currentUser = JSON.parse(
    sessionStorage.getItem("king_admin_user") || "{}",
  );
  // Only primary superadmin 'admin' can edit the 'admin' account
  if (
    editingUserUsername?.toLowerCase() === "admin" &&
    currentUser.username?.toLowerCase() !== "admin"
  ) {
    showToast(
      "Access Denied",
      "Only the primary superadmin can modify the @admin account.",
      "error",
    );
    return;
  }

  const submitBtn = e.target.querySelector("button[type='submit']");
  const originalHtml = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Saving...`;

  const newUsername = document
    .getElementById("new-user-username")
    .value.trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  const passwordInputEl = document.getElementById("new-user-password");
  const newPassword = passwordInputEl ? passwordInputEl.value : "";
  const newName = document.getElementById("new-user-name").value.trim();
  const newRole = document.getElementById("new-user-role").value.trim();
  const newAvatar = document
    .getElementById("new-user-avatar")
    .value.trim()
    .toUpperCase();
  const accessLevel = document.getElementById("new-user-access").value;
  const isNewAdmin = accessLevel === "admin";

  if (!newUsername) {
    showToast("Error", "Username is required.", "error");
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHtml;
    return;
  }

  // Password is only required for user creation, not user editing
  if (!newPassword && !editingUserUsername) {
    showToast("Error", "Password is required for new users.", "error");
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHtml;
    return;
  }

  try {
    const existingUsers = localDataStore["profile"]?.users || [];

    // Resolve password hash
    let passwordHash = "";
    if (editingUserUsername) {
      if (!newPassword) {
        // Keep existing password
        const oldUser = existingUsers.find(
          (u) => u.username === editingUserUsername,
        );
        passwordHash = oldUser ? oldUser.password : "";
      } else {
        const isAlreadyHashed = /^[a-fA-F0-9]{64}$/.test(newPassword);
        passwordHash = isAlreadyHashed
          ? newPassword
          : await hashPassword(newPassword);
      }
    } else {
      passwordHash = await hashPassword(newPassword);
    }

    const newUser = {
      username: newUsername,
      password: passwordHash,
      name: newName,
      role: newRole,
      avatar: newAvatar,
      isAdmin: isNewAdmin,
    };

    const docRef = doc(db, "users", newUsername);

    // Double check exists only if creating a NEW user (not editing)
    if (!editingUserUsername) {
      // Prevent duplicate username check against reserved primary admin name
      if (newUsername === "admin") {
        showToast(
          "Reserved Username",
          "The username @admin is reserved for the primary superadmin account.",
          "error",
        );
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
        return;
      }

      // Check local cache
      const isDuplicate = existingUsers.some(
        (u) => u.username?.toLowerCase() === newUsername,
      );
      if (isDuplicate) {
        showToast(
          "User Exists",
          `Username @${newUsername} is already registered.`,
          "error",
        );
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
        return;
      }

      // Check remote Firestore
      const checkSnap = await getDoc(docRef);
      if (checkSnap.exists()) {
        showToast(
          "User Exists",
          `Username @${newUsername} is already registered.`,
          "error",
        );
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
        return;
      }
    }

    await setDoc(docRef, newUser);
    showToast(
      editingUserUsername ? "User Updated" : "User Created",
      `Authorized access details saved for @${newUsername}.`,
    );

    // Reset editing state and form
    window.cancelEditUser();

    loadTab("profile");
  } catch (error) {
    console.error("Save user error:", error);
    showToast("Save Failed", "Could not write user record.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHtml;
  }
};

// Delete user account
window.deleteUser = async function (username) {
  // Block deleting superadmin
  if (username.toLowerCase() === "admin") {
    showToast(
      "Access Denied",
      "The primary superadmin account @admin cannot be deleted.",
      "error",
    );
    return;
  }

  // Guard access control
  const currentUser = JSON.parse(
    sessionStorage.getItem("king_admin_user") || "{}",
  );
  if (!currentUser.isAdmin) {
    showToast(
      "Access Denied",
      "Only administrators can delete users.",
      "error",
    );
    return;
  }

  if (
    !confirm(
      `Are you sure you want to revoke database dashboard access for @${username}?`,
    )
  ) {
    return;
  }

  try {
    const docRef = doc(db, "users", username.toLowerCase());
    await deleteDoc(docRef);
    showToast(
      "User Access Revoked",
      `@${username} has been deleted from users collection.`,
    );
    loadTab("profile");
  } catch (error) {
    console.error("Delete user error:", error);
    showToast(
      "Revocation Failed",
      "Could not remove user document from Firestore.",
      "error",
    );
  }
};

// Edit existing dashboard user details
window.editUser = function (username) {
  const currentUser = JSON.parse(
    sessionStorage.getItem("king_admin_user") || "{}",
  );
  // Only primary superadmin can edit 'admin'
  if (
    username.toLowerCase() === "admin" &&
    currentUser.username?.toLowerCase() !== "admin"
  ) {
    showToast(
      "Access Denied",
      "Only the primary superadmin can modify the @admin account.",
      "error",
    );
    return;
  }

  const existingUsers = localDataStore["profile"]?.users || [];
  const u = existingUsers.find((user) => user.username === username);
  if (!u) return;

  editingUserUsername = username;

  // Update Form Title
  const formTitle = document.getElementById("create-user-form-title");
  if (formTitle)
    formTitle.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width:18px;height:18px;color:var(--gold);"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> Edit Dashboard User (@${username})`;

  // Populate inputs
  const usernameInput = document.getElementById("new-user-username");
  if (usernameInput) {
    usernameInput.value = username;
    usernameInput.disabled = true;
    usernameInput.style.opacity = "0.5";
  }

  const passContainer = document.getElementById("new-user-password-container");
  if (passContainer) {
    passContainer.innerHTML = `
      <label class="form-label">User Password</label>
      <button type="button" class="btn btn-secondary" onclick="showChangeUserPasswordInput()" style="width: 100%; height: var(--input-height, 42px); padding: 0 16px; font-size: 0.85rem; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 8px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
        Change User Password
      </button>
    `;
  }

  const nameInput = document.getElementById("new-user-name");
  if (nameInput) nameInput.value = u.name || "";

  const roleInput = document.getElementById("new-user-role");
  if (roleInput) roleInput.value = u.role || "";

  const avatarInput = document.getElementById("new-user-avatar");
  if (avatarInput) avatarInput.value = u.avatar || "";

  const accessSelect = document.getElementById("new-user-access");
  if (accessSelect) accessSelect.value = u.isAdmin ? "admin" : "user";

  // Update Submit Button
  const submitBtn = document.getElementById("btn-create-user");
  if (submitBtn) {
    submitBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; vertical-align: middle;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>Save User Changes`;
    submitBtn.className = "btn btn-save";
  }

  // Render Cancel Button
  const cancelContainer = document.getElementById("cancel-edit-user-container");
  if (cancelContainer) {
    cancelContainer.innerHTML = `
      <button type="button" class="btn btn-secondary" onclick="cancelEditUser()" style="width: 100%; margin-top: 5px;">
        ✕ Cancel Editing
      </button>
    `;
  }
};

// Cancel editing dashboard user and revert form back to creation mode
window.cancelEditUser = function () {
  editingUserUsername = null;

  // Reset form
  const form = document.getElementById("create-user-form");
  if (form) form.reset();

  // Restore Title
  const formTitle = document.getElementById("create-user-form-title");
  if (formTitle)
    formTitle.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width:18px;height:18px;color:var(--gold);"><path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg> Create Dashboard User`;

  // Enable username input
  const usernameInput = document.getElementById("new-user-username");
  if (usernameInput) {
    usernameInput.disabled = false;
    usernameInput.style.opacity = "1";
    usernameInput.placeholder = "e.g. vijay";
  }

  // Restore password input field inside container
  const passContainer = document.getElementById("new-user-password-container");
  if (passContainer) {
    passContainer.innerHTML = `
      <label class="form-label">Login Password</label>
      <input type="password" class="form-input" id="new-user-password" placeholder="••••••••••••" required>
    `;
  }

  // Restore Submit Button
  const submitBtn = document.getElementById("btn-create-user");
  if (submitBtn) {
    submitBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; vertical-align: middle;"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>Add User to Database`;
    submitBtn.className = "btn btn-add";
  }

  // Clear Cancel Button
  const cancelContainer = document.getElementById("cancel-edit-user-container");
  if (cancelContainer) cancelContainer.innerHTML = "";
};

// Show Password input field when Admin chooses to reset password for a user
window.showChangeUserPasswordInput = function () {
  const passContainer = document.getElementById("new-user-password-container");
  if (passContainer) {
    passContainer.innerHTML = `
      <label class="form-label">New Password</label>
      <input type="password" class="form-input" id="new-user-password" placeholder="Enter new user password" required>
    `;
  }
};

// Sidebar Toggle (Mobile)
window.toggleSidebar = function () {
  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.classList.toggle("open");
  }
};

// Close modal when clicking on backdrop
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("item-modal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeItemModal();
      }
    });
  }

  // Initialize Auth state check
  checkAuth();
});
