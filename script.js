// Versionsnummer
const APP_VERSION = "v1.0.0-firestore";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, setDoc, doc, updateDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

// Din specifika konfiguration från Firebase Console:
const firebaseConfig = {
  apiKey: "AIzaSyBfxBBFA53g6VMcWk0c5FUUCvoJDCziA1Q",
  authDomain: "utcheckning.firebaseapp.com",
  projectId: "utcheckning",
  storageBucket: "utcheckning.firebasestorage.app",
  messagingSenderId: "332957602039",
  appId: "1:332957602039:web:c979968cba83bde45983f2",
  measurementId: "G-TBTH1WVHQE"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const analytics = getAnalytics(app);
const studentsCol = collection(db, "students");

// Original hardcoded students array (will be used as default if localStorage is empty)
const initialStudents = [
    { id: 1, name: "Adam", avatar: "images/Adam.png", present: true, class: "1A" },
    { id: 2, name: "Aditya", avatar: "images/Aditya.png", present: true, class: "1A" },
    { id: 3, name: "Aleksandar", avatar: "images/Aleksandar.png", present: true, class: "1A" },
    { id: 4, name: "Alice", avatar: "images/Alice.png", present: true, class: "1A" },
    { id: 5, name: "Alva", avatar: "images/Alva.png", present: true, class: "1A" },
    { id: 6, name: "Anton", avatar: "images/Anton.png", present: true, class: "1A" },
    { id: 7, name: "Amir", avatar: "images/Amir.png", present: true, class: "1B" },
    { id: 8, name: "Anette", avatar: "images/Anette.png", present: true, class: "1B" },
    { id: 9, name: "Emma", avatar: "images/Emma.png", present: true, class: "1B" },
    { id: 10, name: "Leo", avatar: "images/Leo.png", present: true, class: "1B" },
];

// Global array för elever som hämtas från databasen
let students = [];

// Håller koll på vilken elev som just nu redigeras i admin-panelen
let editingStudentId = null;
let currentClass = "1A";

// Funktion för att hämta data från Firestore vid start
async function initApp() {
    try {
        const querySnapshot = await getDocs(studentsCol);
        if (querySnapshot.empty) {
            // Om databasen är tom, ladda in initialStudents
            for (const s of initialStudents) {
                await setDoc(doc(db, "students", s.id.toString()), s);
            }
            students = [...initialStudents];
        } else {
            students = querySnapshot.docs.map(doc => doc.data());
        }
        students.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
        renderClassSelector();
        renderStudents();
    } catch (e) { console.error("Kunde inte ladda elever:", e); }
}

const grid = document.getElementById('student-grid');

// Lägg till CSS för layouten dynamiskt
const style = document.createElement('style');
style.textContent = `
    body { display: flex; flex-direction: row; margin: 0; height: 100vh; font-family: sans-serif; overflow: hidden; }
    #class-sidebar { width: 240px; flex-shrink: 0; background: #f4f4f4; padding: 20px; border-right: 1px solid #ddd; display: flex; flex-direction: column; height: 100vh; box-sizing: border-box; overflow: hidden; }
    #main-wrapper { flex-grow: 1; display: flex; flex-direction: column; align-items: center; height: 100vh; overflow-y: auto; }
    header { text-align: center; padding: 40px 20px 0; width: 100%; box-sizing: border-box; }
    #student-grid { width: 100%; padding: 40px; box-sizing: border-box; }
    .group-header { text-align: center; margin-bottom: 30px; width: 100%; font-size: 2rem; }
    .class-btn { width: 100%; padding: 12px; margin-bottom: 8px; border: 1px solid #ddd; border-radius: 8px; background: white; cursor: pointer; text-align: left; font-weight: bold; transition: all 0.2s; }
    .class-btn:hover { background: #f0f0f0; }
    .class-btn.active { background: #007bff; color: white; border-color: #0056b3; }
    .admin-btn { margin-top: auto; margin-bottom: 10px; padding: 15px; border: none; border-radius: 8px; background: #333; color: white; cursor: pointer; font-weight: bold; text-align: center; transition: background 0.2s; }
    .admin-btn:hover { background: #000; }
    .version-info { text-align: center; font-size: 0.75rem; color: #aaa; margin-bottom: 15px; }
    .status-group { margin-bottom: 50px; }
    /* Admin Modal Styles */
    .admin-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        display: none; /* Hidden by default */
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    .admin-modal-content {
        background: white;
        padding: 30px;
        border-radius: 12px;
        width: 90%;
        max-width: 700px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        position: relative;
        max-height: 90vh;
        overflow-y: auto;
    }
    .admin-modal-content h3 {
        margin-top: 0;
        color: #333;
        border-bottom: 1px solid #eee;
        padding-bottom: 10px;
        margin-bottom: 20px;
    }
    .admin-modal-content label {
        display: block;
        margin-bottom: 8px;
        font-weight: bold;
        color: #555;
    }
    .admin-modal-content input[type="text"],
    .admin-modal-content select {
        width: calc(100% - 22px); /* Account for padding and border */
        padding: 10px;
        margin-bottom: 15px;
        border: 1px solid #ccc;
        border-radius: 6px;
        font-size: 1rem;
    }
    .admin-modal-content button {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        transition: background 0.2s;
    }
    .admin-modal-content .add-student-btn {
        background: #28a745;
        color: white;
    }
    .admin-modal-content .add-student-btn:hover {
        background: #218838;
    }
    .admin-modal-content .close-modal-btn {
        position: absolute;
        top: 15px;
        right: 15px;
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #888;
    }
    .admin-modal-content .close-modal-btn:hover {
        color: #333;
    }
    .student-admin-list {
        list-style: none;
        padding: 0;
        margin-top: 20px;
    }
    .student-admin-list li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 0;
        border-bottom: 1px solid #eee;
    }
    .student-admin-list li:last-child {
        border-bottom: none;
    }
    .student-admin-list .remove-student-btn {
        background: #dc3545;
        color: white;
        padding: 8px 12px;
        font-size: 0.9rem;
    }
    .student-admin-list .remove-student-btn:hover {
        background: #c82333;
    }
    .student-admin-list .edit-student-btn {
        background: #ffc107;
        color: #212529;
        padding: 8px 12px;
        font-size: 0.9rem;
        margin-right: 5px;
    }
    .student-admin-list .edit-student-btn:hover {
        background: #e0a800;
    }
    .admin-modal-footer {
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #eee;
        display: flex;
        justify-content: flex-end;
    }
    .admin-modal-footer button { margin-left: 10px; }
    .save-close-btn { background: #007bff !important; color: white !important; }
    .save-close-btn:hover { background: #0056b3 !important; }
    .export-btn { background: #6c757d !important; color: white !important; }
    .export-btn:hover { background: #5a6268 !important; }
    .import-btn { background: #17a2b8 !important; color: white !important; }
    .import-btn:hover { background: #138496 !important; }
    /* Elevkort och avatarer */
    .student-list { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }
    .student-card { 
        background: white; border: 1px solid #eee; border-radius: 20px; padding: 15px; 
        width: 130px; display: flex; flex-direction: column; align-items: center; 
        cursor: pointer; transition: all 0.3s ease; box-shadow: 0 10px 20px rgba(0,0,0,0.08);
        outline: none; /* Tar bort den blå runda ringen som visas vid klick */
    }
    .student-card:hover { transform: translateY(-5px); box-shadow: 0 15px 30px rgba(0,0,0,0.12); }
    .student-card.is-out { opacity: 0.5; filter: grayscale(0.8); }
    .student-card.is-out:hover { transform: none; box-shadow: 0 10px 20px rgba(0,0,0,0.08); }
    .avatar { width: 90px; height: 90px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; border: none; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
    .student-name { font-weight: bold; color: #333; font-size: 1.1rem; }
    .status-label { font-size: 0.85rem; color: #999; margin-top: 5px; }

    /* Responsiv design för tablets och mobiler */
    @media (max-width: 850px) {
        body { flex-direction: column; overflow-y: auto; height: auto; }
        #class-sidebar { 
            width: 100%; 
            height: auto; 
            border-right: none; 
            border-bottom: 1px solid #ddd; 
            padding: 15px;
            position: sticky;
            top: 0;
            z-index: 100;
        }
        #class-sidebar h2 { font-size: 1.2rem; margin-bottom: 10px !important; }
        
        /* Gör klasslistan horisontellt rullbar på mobilen */
        #class-sidebar > div { 
            display: flex; 
            flex-direction: row !important; 
            overflow-x: auto !important; 
            gap: 8px; 
            padding-bottom: 5px;
            -webkit-overflow-scrolling: touch;
        }
        .class-btn { width: auto; margin-bottom: 0; white-space: nowrap; flex-shrink: 0; }
        
        #main-wrapper { height: auto; overflow: visible; }
        #student-grid { padding: 20px 10px; }
        header { padding: 20px 10px 0; }
        header h1 { font-size: 1.5rem; }
        .admin-btn { width: 100%; margin-top: 10px; padding: 10px; }
        .version-info { display: none; }
        .student-card { width: 110px; padding: 10px; }
        .avatar { width: 70px; height: 70px; }
    }
`;
document.head.appendChild(style);

// Organisera om DOM-strukturen för korrekt layout
const sidebar = document.createElement('nav');
sidebar.id = 'class-sidebar';

const mainWrapper = document.createElement('div');
mainWrapper.id = 'main-wrapper';

const header = document.querySelector('header');
document.body.prepend(sidebar);
document.body.appendChild(mainWrapper);
mainWrapper.appendChild(header);
mainWrapper.appendChild(grid);

function renderClassSelector() {
    const classes = [...new Set(students.map(s => s.class))].sort();
    sidebar.innerHTML = `
        <h2 style="margin-top: 0; text-align: center;">Klasser</h2>
        <div style="flex-grow: 1; overflow: hidden;">
            ${classes.map(cls => {
                const count = students.filter(s => s.class === cls && s.present).length;
                return `
                    <button class="class-btn ${cls === currentClass ? 'active' : ''}" onclick="switchClass('${cls}')">
                        Klass ${cls} (${count})
                    </button>
                `;
            }).join('')}
        </div>
        <button class="admin-btn" onclick="openAdminWithPassword()">⚙️ Admin</button>
        <div class="version-info">${APP_VERSION}</div>
    `;
}

window.openAdminWithPassword = () => {
    const password = prompt("Ange administratörslösenord:");
    if (password === "skola123") {
        renderAdminPanel();
    } else if (password !== null) {
        alert("Fel lösenord!");
    }
};

window.switchClass = (cls) => {
    currentClass = cls;
    renderClassSelector();
    renderStudents();
};

function renderStudents() {
    // Skapa sektioner för närvarande och utcheckade
    grid.innerHTML = `
        <div class="status-group" id="group-present">
            <h2 class="group-header">Här (${currentClass})</h2>
            <div class="student-list"></div>
        </div>
        <div class="status-group" id="group-out">
            <h2 class="group-header">Utcheckade</h2>
            <div class="student-list"></div>
        </div>
    `;

    const presentContainer = grid.querySelector('#group-present .student-list');
    const outContainer = grid.querySelector('#group-out .student-list');

    students
        .filter(student => student.class === currentClass)
        .forEach(student => {
        const card = document.createElement('button');
        card.className = `student-card ${student.present ? '' : 'is-out'}`;
        card.setAttribute('aria-pressed', !student.present);
        
        // viewTransitionName gör att webbläsaren kan identifiera elementet och animera dess flytt
        card.style.viewTransitionName = `student-card-${student.id}`;
        
        card.innerHTML = `
            <img src="${student.avatar}" alt="${student.name}" class="avatar">
            <div class="student-name">${student.name}</div>
            <div class="status-label">${student.present ? 'Här' : 'Utcheckad'}</div>
        `;

        card.onclick = () => togglePresence(student.id);
        (student.present ? presentContainer : outContainer).appendChild(card);
    });
}

window.togglePresence = async (id) => {
    const student = students.find(s => s.id === Number(id));
    if (student) {
        student.present = !student.present;
        
        await updateDoc(doc(db, "students", id.toString()), { present: student.present });

        console.log(`${student.name} status ändrad till: ${student.present ? 'Närvarande' : 'Utcheckad'}`);
        
        // Använd View Transitions API för en mjuk animation om webbläsaren stöder det
        if (document.startViewTransition) {
            document.startViewTransition(() => {
                renderStudents();
                renderClassSelector();
            });
        } else {
            renderStudents();
            renderClassSelector();
        }
    }
};

// Denna funktion behövs inte längre med Firestore eftersom vi sparar per ändring, 
// men vi behåller namnet för att inte bryta logiken om det anropas.
function saveStudents() {
    console.log("Data synkad med Firestore.");
}

// Funktion för att rendera adminpanelen (modalen)
function renderAdminPanel() {
    let adminModal = document.getElementById('admin-modal');
    if (!adminModal) {
        adminModal = document.createElement('div');
        adminModal.id = 'admin-modal';
        adminModal.className = 'admin-modal-overlay';
        document.body.appendChild(adminModal);
    }

    // Hämta unika klasser för datalistan i formuläret
    const classes = [...new Set(students.map(s => s.class))].sort(); 

    adminModal.innerHTML = `
        <div class="admin-modal-content">
            <button class="close-modal-btn" onclick="closeAdminPanel()">×</button>
            <h3>Lägg till elev</h3>
            <form id="add-student-form">
                <label for="new-student-name">Namn:</label>
                <input type="text" id="new-student-name" required>
                <label for="new-student-class">Klass:</label>
                <input type="text" id="new-student-class" list="class-options" required>
                <datalist id="class-options">
                    ${classes.map(cls => `<option value="${cls}">`).join('')}
                </datalist>
                <button type="submit" class="add-student-btn">Lägg till</button>
            </form>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3 style="margin: 0;">Hantera elever</h3>
                <button class="edit-student-btn" style="background: #6f42c1; color: white; margin: 0;" onclick="renameClassGroup()">
                    Byt namn på en hel klass
                </button>
            </div>
            
            <ul class="student-admin-list">
                ${students.map(student => `
                    <li>
                        ${editingStudentId === student.id ? `
                            <div style="display: flex; gap: 5px; width: 100%;">
                                <input type="text" id="edit-name-${student.id}" value="${student.name}" style="flex: 2; margin: 0; padding: 5px;">
                                <input type="text" id="edit-class-${student.id}" value="${student.class}" list="class-options" style="flex: 1; margin: 0; padding: 5px;">
                                <button class="add-student-btn" onclick="updateStudent(${student.id})" style="padding: 5px 10px;">Spara</button>
                                <button class="remove-student-btn" onclick="setEditingStudent(null)" style="padding: 5px 10px; background: #6c757d;">X</button>
                            </div>
                        ` : `
                            <span>${student.name} (${student.class})</span>
                            <div>
                                <button class="edit-student-btn" onclick="setEditingStudent(${student.id})">Ändra</button>
                                <button class="remove-student-btn" onclick="removeStudent(${student.id})">Ta bort</button>
                            </div>
                        `}
                    </li>
                `).join('')}
            </ul>
            <div class="admin-modal-footer">
                <button class="export-btn" onclick="exportStudents()">Exportera lista</button>
                <button class="import-btn" onclick="importStudents()">Importera lista</button>
                <button class="save-close-btn" onclick="closeAdminPanel()">Spara och stäng</button>
            </div>
        </div>
    `;

    adminModal.style.display = 'flex'; // Visa modalen

    // Lägg till eventlyssnare för formuläret
    document.getElementById('add-student-form').addEventListener('submit', function(event) {
        event.preventDefault();
        const name = document.getElementById('new-student-name').value.trim();
        const className = document.getElementById('new-student-class').value.trim().toUpperCase(); // Standardisera klassnamn till versaler
        if (name && className) {
            addStudent(name, className);
            document.getElementById('new-student-name').value = ''; // Rensa formuläret
            document.getElementById('new-student-class').value = ''; // Rensa formuläret
        } else {
            alert('Vänligen fyll i både namn och klass.');
        }
    });
}

// Funktion för att stänga adminpanelen
window.closeAdminPanel = () => {
    document.getElementById('admin-modal').style.display = 'none';
}

// Funktion för att lägga till en elev
function addStudent(name, className) {
    if (students.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        alert(`En elev med namnet "${name}" finns redan.`);
        return;
    }
    const newId = students.length > 0 ? Math.max(...students.map(s => s.id)) + 1 : 1;
    const newStudent = {
        id: newId,
        name: name,
        avatar: `images/${name}.png`, // Automatisk sökväg till avatar
        present: true, // Nya elever är närvarande som standard
        class: className
    };
    
    setDoc(doc(db, "students", newId.toString()), newStudent);
    students.push(newStudent);
    students.sort((a, b) => a.name.localeCompare(b.name, 'sv')); // Sortera om listan
    renderClassSelector();
    renderStudents();
    renderAdminPanel(); // Uppdatera adminpanelen (t.ex. listan över elever att ta bort)
}

// Funktion för att redigera en elev
// Sätt vilken elev som ska redigeras
window.setEditingStudent = (id) => {
    editingStudentId = id;
    renderAdminPanel();
};

// Spara ändringar för en specifik elev
window.updateStudent = async (id) => {
    const student = students.find(s => s.id === id);
    const newName = document.getElementById(`edit-name-${id}`).value.trim();
    const newClass = document.getElementById(`edit-class-${id}`).value.trim().toUpperCase();

    if (!newName || !newClass) return;

    student.name = newName;
    student.class = newClass;
    student.avatar = `images/${newName}.png`;

    const studentRef = doc(db, "students", id.toString());
    await updateDoc(studentRef, { name: newName, class: newClass, avatar: student.avatar });

    editingStudentId = null;
    students.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
    renderClassSelector();
    renderStudents();
    renderAdminPanel();
};

// Byt namn på en hel klass (t.ex. vid läsårsbyte)
window.renameClassGroup = async () => {
    const oldClass = prompt("Vilken klass vill du byta namn på? (t.ex. 1A)").trim().toUpperCase();
    if (!oldClass || !students.some(s => s.class === oldClass)) {
        alert("Hittade ingen klass med det namnet.");
        return;
    }
    
    const newClass = prompt(`Vad ska klass ${oldClass} heta istället?`).trim().toUpperCase();
    if (!newClass) return;
    
    const batch = writeBatch(db);
    students.forEach(s => {
        if (s.class === oldClass) {
            s.class = newClass;
            batch.update(doc(db, "students", s.id.toString()), { class: newClass });
        }
    });
    
    await batch.commit();
    renderClassSelector();
    renderStudents();
    renderAdminPanel();
};

// Funktion för att exportera elevlistan till en JSON-fil
window.exportStudents = () => {
    const dataStr = JSON.stringify(students, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `elevlista-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
};

// Funktion för att importera en elevlista från en JSON-fil
window.importStudents = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (Array.isArray(importedData)) {
                    if (confirm("Varning: Detta kommer att ersätta din nuvarande lista. Vill du fortsätta?")) {
                        // Här borde man egentligen rensa Firestore först
                        for (const s of importedData) {
                            await setDoc(doc(db, "students", s.id.toString()), s);
                        }
                        students = importedData;
                        students.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
                        renderClassSelector();
                        renderStudents();
                        renderAdminPanel();
                    }
                } else {
                    alert("Felaktigt filformat. Filen måste innehålla en lista med elever.");
                }
            } catch (err) {
                alert("Kunde inte läsa filen. Se till att det är en giltig JSON-fil.");
            }
        };
        reader.readAsText(file);
    };
    input.click();
};

// Funktion för att ta bort en elev
window.removeStudent = async (id) => {
    const studentToRemove = students.find(s => s.id === id);
    if (!studentToRemove) return;
    if (!confirm(`Är du säker på att du vill ta bort ${studentToRemove.name} (${studentToRemove.class})?`)) { return; }
    
    await deleteDoc(doc(db, "students", id.toString()));
    students = students.filter(s => s.id !== id);
    
    renderClassSelector();
    renderStudents();
    renderAdminPanel(); // Uppdatera adminpanelen
};

// Starta appen
initApp();