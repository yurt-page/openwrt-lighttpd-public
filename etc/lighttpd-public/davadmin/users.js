let users = new Map()

function parseHtpasswd(data) {
    let usersLines = data.split("\n")
    let users = new Map()
    for (let userLine of usersLines) {
        let userFields = userLine.split(":")
        if (userFields.length < 2) {
            continue
        }
        let username = userFields[0]
        let password = userFields[1]
        users.set(username, password)
    }
    return users
}

function renderUsersTbl() {
    let usersTbl = document.getElementById("usersTbl")
    // clear all rows
    for (let i = usersTbl.rows.length - 1; i >= 0; i--) {
        usersTbl.deleteRow(i)
    }
    for (let [username, password] of users) {
        let row = usersTbl.insertRow()
        let cell1 = row.insertCell(0)
        let cell2 = row.insertCell(1)
        let cell3 = row.insertCell(2)
        cell1.innerText = username
        cell2.innerHTML = `<button onclick='userResetPassword("${username}")'>🔑 Set password</button>`
        if (!username.startsWith("admin")) {
            cell3.innerHTML = `<button onclick='userRemove("${username}")'>❌ Remove</button>`
        }
    }
}

function reloadUsers() {
    fetch('./webdav_users.txt')
        .then((response) => response.text())
        .then((data) => {
            users = parseHtpasswd(data)
            renderUsersTbl()
            reloadAuthFolders()
        })
}

function usersAdd() {
    let username = prompt("Input username", '')
    if (!username) {
        return
    }
    if (!username.match(/^[0-9a-z_\-.@]+$/)) {
        alert("Bad username")
        return
    }
    users.set(username, '')
    userResetPassword(username)
    renderUsersTbl()
    if (confirm("Create a folder for the user?")) {
        let folder = '/' + username
        createUserFolder(folder, username)
    }
    alert(`A new user is added.\n` +
        `username: ${username}\n` +
        `Don't forget to save users and folders.`
    )
}

function userRemove(username) {
    if (username.startsWith("admin")) {
        alert("Sorry, you can't remove admin user")
        return
    }
    if (confirm(`Remove user ${username}?`)) {
        users.delete(username)
        renderUsersTbl()
        usersSaveNeeded(true)
    }
}

function genPassword() {
    return Math.random().toString(36).slice(2)
}

function userResetPassword(username) {
    let password = users.get(username)
    if (!password) {
        password = genPassword()
    }
    let newPassword = prompt("Input a new password (alphanumeric).\nLeave empty to generate a new", password)
    if (!newPassword) {
        newPassword = genPassword()
        alert(`A new password was generated ${newPassword}`)
    }
    if (!newPassword.match(/^[0-9a-z]+$/)) {
        alert("Bad password")
        return
    }
    users.set(username, newPassword)
    usersSaveNeeded(true)
}


function usersSerialize() {
    let htpasswd = ""
    for (const [username, password] of users) {
        htpasswd += username + ":" + password + "\n"
    }
    return htpasswd;
}

async function usersSave() {
    let fileContent = usersSerialize()
    await putData('./webdav_users.txt', fileContent)
    alert("Users saved\nYou need to wait for 10 minutes to auth cache to expire.\nYou can restart the lighttpd to apply now")
    usersSaveNeeded(false)
}

async function putData(url, data) {
    // Default options are marked with *
    let response = await fetch(url, {
        method: 'PUT',
        headers: {'Content-Type': 'text/plain;charset=utf-8'},
        body: data
    })
}

function usersSaveNeeded(usersWasChanged) {
    document.getElementById("usersSaveBtn").disabled = !usersWasChanged
}

function usersAddApp() {
    let appName = prompt("Input the app name (alphanumeric)", '')
    if (!appName || !appName.match(/^[0-9a-z]+$/)) {
        alert("Bad app name")
        return
    }
    let username = "app-" + appName
    if (users.has(username)) {
        alert("Bad app name: already exists")
        return
    }
    let newPassword = genPassword()
    let folder = "/apps/" + appName

    users.set(username, newPassword)
    usersSaveNeeded(true)
    renderUsersTbl()
    createUserFolder(folder, username);
    alert(`A new app user is added.\n` +
        `username: ${username}\n` +
        `password ${newPassword}\n` +
        `folder ${folder}\n` +
        `Don't forget to save users and folders.`
    )
}

window.addEventListener("load", reloadUsers)