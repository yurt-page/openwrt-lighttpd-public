let authFolders = new Map()

function parseAuthFolders(data) {
    let lines = data.split("\n")
    let authFolders = new Map()
    let curFolder = ""
    let curFolderUsers = ""
    for (let confLine of lines) {
        // remove comments
        let line = confLine.split("#")[0].trim()
        if (!line) {
            continue
        }
        if (line === "auth.require = (") {
            continue
        }
        // folder
        if (curFolder === "") {
            let folderStartPos = line.indexOf(`"/dav/`)
            if (folderStartPos !== -1) {
                let folderNameStartPos = folderStartPos + 5
                let folderEndPos = line.indexOf('"', folderNameStartPos)
                if (folderEndPos === -1) { // the whole /dav/ folder itself
                    curFolder = "/"
                } else {
                    curFolder = line.substring(folderNameStartPos, folderEndPos)
                }
            }
        } else {
            // we are inside of folder
            // folder is closed
            if (line.startsWith(")")) {
                let userList = parseFolderUsers(curFolderUsers)
                authFolders.set(curFolder, userList)
                curFolder = ""
            }
            // search for "require" option with user list
            let requirePos = line.indexOf(`"require" => "`);
            if (requirePos !== -1) {
                let requireStartPos = requirePos + `"require" => "`.length;
                let requireEndPos = line.indexOf('"', requireStartPos)
                if (requireEndPos !== -1) {
                    curFolderUsers = line.substring(requireStartPos, requireEndPos)
                }
            }
        }
    }
    return authFolders
}

function reloadAuthFolders() {
    fetch('./webdav_folders.conf')
        .then((response) => response.text())
        .then((data) => {
            authFolders = parseAuthFolders(data)
            renderAuthFoldersTbl()
        })
}

function renderAuthFoldersTbl() {
    console.log(authFolders)
    let authFoldersTbl = document.getElementById("authFoldersTbl")
    // clear all rows
    for (let i = authFoldersTbl.rows.length - 1; i >= 0; i--) {
        authFoldersTbl.deleteRow(i)
    }
    for (let [folder, users] of authFolders) {
        let row = authFoldersTbl.insertRow()
        let cell1 = row.insertCell(0)
        let cell2 = row.insertCell(1)
        let cell3 = row.insertCell(2)
        let cell4 = row.insertCell(3)
        cell1.innerText = folder
        cell2.innerText = users
        cell3.innerHTML = `<button onclick='authFoldersEditUsers("${folder}")'>👤 Edit users</button>`
        if (folder !== "/") {
            cell4.innerHTML = `<button onclick='authFoldersRemove("${folder}")'>❌ Remove</button>`
        }
    }
}

function authFoldersAdd() {
    let folder = prompt("Input folder path", '/')
    if (!folder) {
        return
    }
    if (!folder.match(/^[0-9a-z_\-./]+$/)) {
        alert("Bad folder name")
        return
    }
    if (!folder.startsWith('/')) {
        folder = '/' + folder
    }
    authFoldersPrepend(folder, "")
    authFoldersEditUsers(folder)
    mkdir(folder)
}

function authFoldersEditUsers(folder) {
    let userList = authFolders.get(folder)
    if (!userList) {
        userList = ''
    }
    let newFolderUsersConf = prompt("Input users allowed to open the folder (comma separated)", userList)
    // check usernames. Allow comma for separation but also user= and valid-user
    if (newFolderUsersConf && !newFolderUsersConf.match(/^[0-9a-z,|=-]+$/)) {
        alert("Bad chars in user names")
        return
    }
    let newUsers = parseFolderUsers(newFolderUsersConf)
    authFolders.set(folder, newUsers)
    renderAuthFoldersTbl()
    authFoldersSaveNeeded(true)
}

function authFoldersRemove(folder) {
    if (folder === "/") {
        alert("Sorry, you can't remove root folder")
        return
    }
    if (confirm(`Remove folder ${folder}?`)) {
        authFolders.delete(folder)
        renderAuthFoldersTbl()
        authFoldersSaveNeeded(true)
    }
}

async function authFoldersSave() {
    let fileContent = authFoldersSerialize()
    await putData('./webdav_folders.conf', fileContent)
    alert("Folders saved\nYou need to restart the lighttpd. Use command\n    service lighttpd-public restart")
    authFoldersSaveNeeded(false)
}

function authFoldersSaveNeeded(wasChanged) {
    document.getElementById("authFoldersSaveBtn").disabled = !wasChanged
}

function toFolderUsersConf(users) {
    return users.split(',').map(username => username === "valid-user" ? username : "user=" + username).join("|");
}

function authFoldersSerialize() {
    let conf = "auth.require = (\n"
    for (const [folder, users] of authFolders) {
        let folderUsersConf = toFolderUsersConf(users)
        conf += `  "/dav${folder}" => (\n`
        conf += `    "method" => "basic",\n`
        conf += `    "realm" => "disk",\n`
        conf += `    "require" => "user=admin|${folderUsersConf}"\n`
        conf += `  ),\n`
    }
    conf += `)\n` // close auth.require = (
    console.log(conf)
    return conf;
}

function parseFolderUsers(folderUsersConf) {
    // is it comma separated or lighttpd conf with user= ?
    let folderUsers = folderUsersConf.includes(',') ? folderUsersConf.split(',') : folderUsersConf.split('|')

    let folderUsernames = []
    // remove user= prefix if any
    for (let i = 0; i < folderUsers.length; i++) {
        let userField = folderUsers[i].trim()
        if (userField.startsWith("user=")) {
            userField = userField.substring("user=".length)
        }
        if (userField !== "admin" && userField !== "") {
            folderUsernames.push(userField)
        }
    }
    // check existing users
    for (let username of folderUsernames) {
        if (username !== "valid-user" && !users.has(username)) {
            alert(`The user used for folder is not found: ${username}`)
        }
    }
    return folderUsernames.join(",")
}

function authFoldersPrepend(newFolder, newFolderUsers) {
    let newAuthFolders = new Map()
    newAuthFolders.set(newFolder, newFolderUsers)
    // copy back
    for (let [folder, users] of authFolders) {
        newAuthFolders.set(folder, users)
    }
    authFolders = newAuthFolders
}

function createUserFolder(folder, username) {
    authFoldersPrepend(folder, username)
    authFoldersSaveNeeded(true)
    renderAuthFoldersTbl()
    mkdir(folder)
}

function mkdir(path) {
    alert(`Once you press OK the folder will be created and you'll be asked for the admin password.`)
    fetch('../dav'+path, {
        method: 'MKCOL',
        credentials: 'include',
        body: ''
    })
        .then((response) => {
            if (response.ok) {
                alert("The folder created: " + path)
            } else {
                alert("The folder wasn't created")
            }
        })
}
