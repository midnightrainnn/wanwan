// x-page.js — 仿 X (Twitter) 页面

var X_SESSION_UID_KEY = 'wanwan_x_uid'
var X_PROFILE_PREFIX = 'wanwan_x_profile_'
var X_FEED_PREFIX = 'wanwan_x_feed_'
var X_COMMENTS_PREFIX = 'wanwan_x_comments_'
var X_GEN_IMG_PREF_PREFIX = 'wanwan_x_genimg_pref_'

async function getXGenImagePref(user) {
  if (!user || user.id == null || !window.db || !db.config) return true
  try {
    var row = await db.config.get(X_GEN_IMG_PREF_PREFIX + user.id)
    return row && row.value != null ? !!row.value : true
  } catch (e) { return true }
}

async function saveXGenImagePref(user, enabled) {
  if (!user || user.id == null || !window.db || !db.config) return
  try { await db.config.put({ key: X_GEN_IMG_PREF_PREFIX + user.id, value: !!enabled }) } catch (e) {}
}

window.showXPage = async function() {
  var user = await getXSessionUser()
  if (!user) {
    showXLoginPage()
    return
  }
  await renderXPage(user)
}

async function renderXPage(user) {
  var existing = document.getElementById('x-page')
  if (existing) existing.remove()

  var feed = await getXFeed(user)

  var page = document.createElement('div')
  page.id = 'x-page'
  page.className = 'full-page'
  page.dataset.xUid = user.id

  page.innerHTML =
    '<div class="x-topbar">' +
      '<div class="x-topbar-main">' +
        '<div class="x-topbar-avatar">' + getXAvatarHTML(user) + '</div>' +
        '<div class="x-topbar-logo">' +
          '<svg viewBox="0 0 24 24"><g><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></g></svg>' +
        '</div>' +
        '<button class="x-topbar-right" type="button" aria-label="个人主页"><i class="fa-solid fa-circle-user"></i></button>' +
      '</div>' +
      '<div class="x-tabs">' +
        '<div class="x-tab active">' +
          '为你推荐' +
          '<span class="x-tab-arrow"><svg viewBox="0 0 24 24"><g><path d="M3.543 8.96l1.414-1.42L12 14.59l7.043-7.05 1.414 1.42L12 17.41 3.543 8.96z"></path></g></svg></span>' +
        '</div>' +
        '<div class="x-tab">正在跟隨</div>' +
      '</div>' +
    '</div>' +

    '<div class="x-feed" id="x-feed-list">' +
      (feed.length
        ? feed.map(function(post) { return buildXPost(post) }).join('')
        : '<div class="x-feed-empty">还没有动态<br>点右下角发一条，或用魔法棒生成一些</div>') +
    '</div>' +

    '<div class="x-fab-group">' +
      '<button class="x-fab x-fab-secondary" onclick="showXGenerateSheet()" aria-label="生成动态">' +
        '<i class="fa-solid fa-wand-magic-sparkles"></i>' +
      '</button>' +
      '<button class="x-fab" onclick="showXCompose()" aria-label="发帖">' +
        '<i class="fi fi-rr-plus"></i>' +
      '</button>' +
    '</div>' +

    '<div class="x-bottombar">' +
      buildXBottomBar() +
    '</div>'

  if (window.openPage) {
    window.openPage(page)
  } else {
    var app = document.getElementById('app') || document.body
    app.appendChild(page)
  }

  var avatar = page.querySelector('.x-topbar-avatar')
  if (avatar) {
    avatar.setAttribute('role', 'button')
    avatar.setAttribute('aria-label', '退出 X')
    avatar.addEventListener('click', closeXPage)
  }

  var accountBtn = page.querySelector('.x-topbar-right')
  if (accountBtn) {
    accountBtn.addEventListener('click', function(e) {
      e.preventDefault()
      e.stopPropagation()
      showXProfilePage(user)
    })
  }

  // 返回手势 — 从左边缘右滑关闭
  var startX = 0
  var startY = 0
  var tracking = false
  page.addEventListener('touchstart', function(e) {
    var t = e.touches[0]
    if (t.clientX < 25) {
      startX = t.clientX
      startY = t.clientY
      tracking = true
    }
  }, { passive: true })
  page.addEventListener('touchend', function(e) {
    if (!tracking) return
    tracking = false
    var t = e.changedTouches[0]
    var dx = t.clientX - startX
    var dy = Math.abs(t.clientY - startY)
    if (dx > 80 && dy < 100) {
      closeXPage()
    }
  }, { passive: true })

  // 底栏点击
  var items = page.querySelectorAll('.x-bottombar-item')
  items.forEach(function(item) {
    item.addEventListener('click', function() {
      items.forEach(function(i) { i.classList.remove('active') })
      item.classList.add('active')
    })
  })

  bindXFeedEvents(page, user)
}

async function showXProfilePage(user) {
  var existing = document.getElementById('x-profile-page')
  if (existing) existing.remove()
  var profile = await getXProfile(user)

  var page = document.createElement('div')
  page.id = 'x-profile-page'
  page.className = 'full-page x-profile-page'

  var name = getXProfileName(user, profile)
  var handle = getXProfileHandle(user, profile)
  var following = normalizeXCount(profile.following)
  var followers = normalizeXCount(profile.followers)
  page.innerHTML =
    '<div class="x-profile-cover"' + (profile.backgroundImage ? ' style="background-image:url(' + xEscape(profile.backgroundImage) + ')"' : '') + '>' +
      '<button class="x-profile-circle-btn x-profile-back" type="button" aria-label="返回"><i class="fa-solid fa-arrow-left"></i></button>' +
      '<button class="x-profile-circle-btn x-profile-switch" type="button" aria-label="切换账号"><i class="fa-solid fa-right-left"></i></button>' +
      '<button class="x-profile-circle-btn x-profile-edit" type="button" aria-label="编辑个人资料"><i class="fa-solid fa-pen"></i></button>' +
    '</div>' +
    '<div class="x-profile-main">' +
      '<div class="x-profile-avatar">' + getXProfileAvatarHTML(user, profile) + '</div>' +
      '<div class="x-profile-name">' + xEscape(name) + '</div>' +
      '<div class="x-profile-handle">' + xEscape(handle) + '</div>' +
      '<div class="x-profile-joined">' +
        '<i class="fa-regular fa-calendar"></i>' +
        '<span>' + xEscape(getXJoinText(user, profile)) + '</span>' +
        '<i class="fa-solid fa-angle-right"></i>' +
      '</div>' +
      '<div class="x-profile-stats">' +
        '<span><strong>' + xEscape(following) + '</strong> 跟隨中</span>' +
        '<span><strong>' + xEscape(followers) + '</strong> 跟隨者</span>' +
      '</div>' +
    '</div>'

  if (window.openPage) {
    window.openPage(page)
  } else {
    var app = document.getElementById('app') || document.body
    app.appendChild(page)
  }

  page.querySelector('.x-profile-back').addEventListener('click', function(e) {
    e.preventDefault()
    e.stopPropagation()
    closeXProfilePage()
  })

  page.querySelector('.x-profile-edit').addEventListener('click', function(e) {
    e.preventDefault()
    e.stopPropagation()
    showXProfileEditPage(user)
  })

  page.querySelector('.x-profile-switch').addEventListener('click', function(e) {
    e.preventDefault()
    e.stopPropagation()
    showXLoginPage({ replaceExisting: true, returnToProfile: true })
  })
}

async function showXProfileEditPage(user) {
  var existing = document.getElementById('x-profile-edit-page')
  if (existing) existing.remove()
  var profile = await getXProfile(user)

  var page = document.createElement('div')
  page.id = 'x-profile-edit-page'
  page.className = 'full-page x-profile-edit-page'
  page.innerHTML =
    '<div class="x-profile-edit-header">' +
      '<button class="x-profile-edit-back" type="button" aria-label="返回"><i class="fa-solid fa-chevron-left"></i></button>' +
      '<div class="x-profile-edit-title">编辑个人资料</div>' +
      '<button class="x-profile-edit-save" type="button">保存</button>' +
    '</div>' +
    '<div class="x-profile-edit-scroll">' +
      '<button class="x-profile-edit-cover" id="x-edit-cover" type="button"' + (profile.backgroundImage ? ' style="background-image:url(' + xEscape(profile.backgroundImage) + ')"' : '') + '>' +
        '<span><i class="fa-solid fa-image"></i> 背景图</span>' +
      '</button>' +
      '<button class="x-profile-edit-avatar" id="x-edit-avatar" type="button">' + getXProfileAvatarHTML(user, profile) + '</button>' +
      '<input type="hidden" id="x-edit-cover-value" value="' + xEscape(profile.backgroundImage || '') + '">' +
      '<input type="hidden" id="x-edit-avatar-value" value="' + xEscape(profile.avatar || '') + '">' +
      '<label class="x-profile-edit-field">昵称<input id="x-edit-name" class="input-field" value="' + xEscape(profile.name || getXUserName(user)) + '" placeholder="昵称"></label>' +
      '<label class="x-profile-edit-field">用户名<input id="x-edit-handle" class="input-field" value="' + xEscape(stripXAt(profile.handle || getXUserHandle(user))) + '" placeholder="用户名"></label>' +
      '<div class="x-profile-edit-grid">' +
        '<label class="x-profile-edit-field">加入年份<input id="x-edit-join-year" class="input-field" inputmode="numeric" maxlength="4" value="' + xEscape(profile.joinYear) + '"></label>' +
        '<label class="x-profile-edit-field">加入月份<input id="x-edit-join-month" class="input-field" inputmode="numeric" maxlength="2" value="' + xEscape(profile.joinMonth) + '"></label>' +
      '</div>' +
      '<div class="x-profile-edit-grid">' +
        '<label class="x-profile-edit-field">追随中<input id="x-edit-following" class="input-field" inputmode="numeric" value="' + xEscape(normalizeXCount(profile.following)) + '"></label>' +
        '<label class="x-profile-edit-field">跟随者<input id="x-edit-followers" class="input-field" inputmode="numeric" value="' + xEscape(normalizeXCount(profile.followers)) + '"></label>' +
      '</div>' +
    '</div>'

  if (window.openPage) {
    window.openPage(page)
  } else {
    var app = document.getElementById('app') || document.body
    app.appendChild(page)
  }

  page.querySelector('.x-profile-edit-back').addEventListener('click', function() {
    closeXProfileEditPage()
  })
  page.querySelector('#x-edit-cover').addEventListener('click', function() {
    pickXImage(function(imageUrl) {
      page.querySelector('#x-edit-cover-value').value = imageUrl || ''
      page.querySelector('#x-edit-cover').style.backgroundImage = imageUrl ? 'url(' + imageUrl + ')' : ''
    })
  })
  page.querySelector('#x-edit-avatar').addEventListener('click', function() {
    pickXImage(function(imageUrl) {
      page.querySelector('#x-edit-avatar-value').value = imageUrl || ''
      page.querySelector('#x-edit-avatar').innerHTML = imageUrl ? '<img src="' + xEscape(imageUrl) + '" alt="">' : getXAvatarHTML(user)
    })
  })
  page.querySelector('.x-profile-edit-save').addEventListener('click', async function() {
    var next = {
      backgroundImage: page.querySelector('#x-edit-cover-value').value.trim(),
      avatar: page.querySelector('#x-edit-avatar-value').value.trim(),
      name: page.querySelector('#x-edit-name').value.trim() || getXUserName(user),
      handle: stripXAt(page.querySelector('#x-edit-handle').value.trim()) || stripXAt(getXUserHandle(user)),
      joinYear: normalizeXJoinYear(page.querySelector('#x-edit-join-year').value, user),
      joinMonth: normalizeXJoinMonth(page.querySelector('#x-edit-join-month').value, user),
      following: normalizeXCount(page.querySelector('#x-edit-following').value),
      followers: normalizeXCount(page.querySelector('#x-edit-followers').value)
    }
    await saveXProfile(user, next)
    closeXProfileEditPage(true)
    var profilePage = document.getElementById('x-profile-page')
    if (profilePage) profilePage.remove()
    showXProfilePage(user)
  })
}

window.showXCompose = function() {
  var existing = document.getElementById('x-compose')
  if (existing) existing.remove()

  getXSessionUser().then(function(user) {
    renderXCompose(user)
  })
}

function renderXCompose(user) {
  var page = document.createElement('div')
  page.id = 'x-compose'
  page.className = 'full-page x-compose-page'
  page.dataset.imageValue = ''

  page.innerHTML =
    '<div class="x-compose-header">' +
      '<button class="x-compose-cancel">取消</button>' +
      '<button class="x-compose-publish">发布</button>' +
    '</div>' +
    '<div class="x-compose-body">' +
      '<div class="x-compose-avatar">' + getXAvatarHTML(user) + '</div>' +
      '<div class="x-compose-main">' +
        '<div class="x-compose-input" contenteditable="true" data-placeholder="有什么新鲜事？"></div>' +
        '<div class="x-compose-image-preview" id="x-compose-image-preview" hidden>' +
          '<img id="x-compose-image-img" src="" alt="">' +
          '<button class="x-compose-image-remove" type="button" aria-label="移除图片"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="x-compose-footer">' +
      '<div class="x-compose-tools">' +
        '<button class="x-compose-tool" id="x-compose-tool-image" type="button"><i class="fa-solid fa-image"></i></button>' +
        '<button class="x-compose-tool" id="x-compose-tool-hashtag" type="button"><i class="fa-solid fa-hashtag"></i></button>' +
        '<button class="x-compose-tool" id="x-compose-tool-lock" type="button" title="设为专属内容（配图会打码，需要手动解锁查看）"><i class="fa-solid fa-lock"></i></button>' +
      '</div>' +
    '</div>'

  if (window.openPage) {
    window.openPage(page)
  } else {
    var app = document.getElementById('app') || document.body
    app.appendChild(page)
  }

  var cancelBtn = page.querySelector('.x-compose-cancel')
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function(e) {
      e.stopPropagation()
      closeXCompose()
    })
  }

  var imageBtn = page.querySelector('#x-compose-tool-image')
  if (imageBtn) {
    imageBtn.addEventListener('click', function() {
      pickXImage(function(imageUrl) {
        if (!imageUrl) return
        page.dataset.imageValue = imageUrl
        var preview = page.querySelector('#x-compose-image-preview')
        var img = page.querySelector('#x-compose-image-img')
        if (img) img.src = imageUrl
        if (preview) preview.hidden = false
      })
    })
  }

  var removeBtn = page.querySelector('.x-compose-image-remove')
  if (removeBtn) {
    removeBtn.addEventListener('click', function(e) {
      e.stopPropagation()
      page.dataset.imageValue = ''
      var preview = page.querySelector('#x-compose-image-preview')
      if (preview) preview.hidden = true
    })
  }

  var lockBtn = page.querySelector('#x-compose-tool-lock')
  if (lockBtn) {
    lockBtn.addEventListener('click', function() {
      var next = page.dataset.locked === '1' ? '0' : '1'
      page.dataset.locked = next
      lockBtn.classList.toggle('active', next === '1')
    })
  }

  var hashtagBtn = page.querySelector('#x-compose-tool-hashtag')
  if (hashtagBtn) {
    hashtagBtn.addEventListener('click', function() {
      var input = page.querySelector('.x-compose-input')
      if (!input) return
      input.focus()
      try { document.execCommand('insertText', false, '#') } catch (e) { input.textContent += '#' }
    })
  }

  var publishBtn = page.querySelector('.x-compose-publish')
  if (publishBtn) {
    publishBtn.addEventListener('click', function() {
      publishXCompose(page, user)
    })
  }
}

async function publishXCompose(page, user) {
  if (page.dataset.publishing === '1') return
  var input = page.querySelector('.x-compose-input')
  var text = input ? input.textContent.trim() : ''
  var image = page.dataset.imageValue || ''
  var locked = page.dataset.locked === '1' && !!image
  if (!text && !image) {
    window.toast && window.toast('说点什么吧')
    return
  }
  page.dataset.publishing = '1'
  try {
    var profile = await getXProfile(user)
    var post = {
      id: genXPostId(),
      authorId: user.id,
      name: getXProfileName(user, profile),
      handle: getXProfileHandle(user, profile),
      avatar: (profile && profile.avatar) || user.avatar || '',
      verified: false,
      content: text,
      image: image,
      locked: locked,
      unlocked: false,
      createdAt: Date.now(),
      time: '刚刚',
      comments: 0,
      retweets: 0,
      likes: 0,
      liked: false,
      views: 0
    }
    var feed = await getXFeed(user)
    feed.unshift(post)
    await saveXFeed(user, feed)
    closeXCompose()
    await renderXPage(user)
    window.toast && window.toast('已发布')
  } catch (e) {
    console.error('发布 X 帖子失败：', e)
    window.toast && window.toast('发布失败：' + (e.message || e))
  } finally {
    page.dataset.publishing = '0'
  }
}

function showXLoginPage(options) {
  options = options || {}
  var existing = document.getElementById('x-login-page')
  if (existing) existing.remove()
  if (options.replaceExisting) {
    var xPage = document.getElementById('x-page')
    if (xPage) xPage.remove()
    var profilePage = document.getElementById('x-profile-page')
    if (profilePage) profilePage.remove()
    var editPage = document.getElementById('x-profile-edit-page')
    if (editPage) editPage.remove()
  }

  var page = document.createElement('div')
  page.id = 'x-login-page'
  page.className = 'full-page x-login-page'
  if (options.returnToProfile) page.dataset.returnToProfile = '1'
  page.innerHTML =
    '<button class="x-login-close" type="button" aria-label="返回"><i class="fa fa-angle-left"></i></button>' +
    '<div class="x-login-shell">' +
      '<div class="x-login-logo"><svg viewBox="0 0 24 24"><g><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></g></svg></div>' +
      '<div class="x-login-title">登录 X</div>' +
      '<div class="x-login-subtitle">选择微信账号继续</div>' +
      '<button class="x-login-wechat" id="x-login-wechat" type="button">' +
        getXWeChatSvg() +
        '<span>通过微信登录</span>' +
      '</button>' +
      '<div class="x-login-users" id="x-login-users" hidden></div>' +
    '</div>'

  if (window.openPage) {
    window.openPage(page)
  } else {
    var app = document.getElementById('app') || document.body
    app.appendChild(page)
  }

  page.querySelector('.x-login-close').addEventListener('click', function() {
    closeXLoginPage()
  })
  page.querySelector('#x-login-wechat').addEventListener('click', function() {
    renderXLoginUsers(page)
  })
}

async function renderXLoginUsers(page) {
  var list = page.querySelector('#x-login-users')
  if (!list) return
  list.hidden = false
  list.innerHTML = '<div class="x-login-loading"><i class="fa fa-spinner fa-spin"></i></div>'
  var users = await getXUserList()
  if (!users.length) {
    list.innerHTML =
      '<div class="x-login-empty">' +
        '<div>暂无 USER 账号</div>' +
        '<span>请先在角色档案里创建 USER 类型角色</span>' +
      '</div>'
    return
  }
  list.innerHTML = users.map(function(user) {
    var name = getXUserName(user)
    var account = user.identity && user.identity.account ? '@' + user.identity.account : '微信用户'
    return '<button class="x-login-user" type="button" data-uid="' + xEscape(user.id) + '">' +
      '<span class="x-login-user-avatar">' + getXAvatarHTML(user) + '</span>' +
      '<span class="x-login-user-main">' +
        '<span class="x-login-user-name">' + xEscape(name) + '</span>' +
        '<span class="x-login-user-account">' + xEscape(account) + '</span>' +
      '</span>' +
      '<i class="fa fa-angle-right"></i>' +
    '</button>'
  }).join('')

  list.querySelectorAll('.x-login-user').forEach(function(row) {
    row.addEventListener('click', async function() {
      var uid = parseInt(row.dataset.uid)
      var user = users.find(function(item) { return parseInt(item.id) === uid })
      if (!user) return
      setXSessionUser(user)
      var returnToProfile = page.dataset.returnToProfile === '1'
      closeXLoginPage(true)
      await renderXPage(user)
      if (returnToProfile) showXProfilePage(user)
    })
  })
}

function closeXLoginPage(immediate) {
  var page = document.getElementById('x-login-page')
  if (!page) return
  if (immediate) {
    page.remove()
  } else if (window.closePage) {
    window.closePage('x-login-page')
  } else {
    page.remove()
  }
}

window.closeXCompose = function() {
  var page = document.getElementById('x-compose')
  if (!page) return
  if (window.closePage) {
    window.closePage('x-compose')
  } else {
    page.remove()
  }
}

function closeXProfilePage() {
  var page = document.getElementById('x-profile-page')
  if (!page) return
  if (window.closePage) {
    window.closePage('x-profile-page')
  } else {
    page.remove()
  }
}

function closeXProfileEditPage(immediate) {
  var page = document.getElementById('x-profile-edit-page')
  if (!page) return
  if (immediate) {
    page.remove()
  } else if (window.closePage) {
    window.closePage('x-profile-edit-page')
  } else {
    page.remove()
  }
}

function closeXPage() {
  var page = document.getElementById('x-page')
  if (!page) return
  if (window.closePage) {
    window.closePage('x-page')
  } else {
    page.remove()
  }
}

async function getXUserList() {
  if (!window.db || !db.characters) return []
  try {
    return await db.characters.where('type').equals('user').toArray()
  } catch (e) {
    return (await db.characters.toArray()).filter(function(user) { return user.type === 'user' })
  }
}

async function getXSessionUser() {
  var stored = localStorage.getItem(X_SESSION_UID_KEY)
  if (!stored) return null
  var uid = parseInt(stored)
  if (!Number.isFinite(uid)) {
    localStorage.removeItem(X_SESSION_UID_KEY)
    return null
  }
  var user = window.getCharacter ? await window.getCharacter(uid) : await db.characters.get(uid)
  if (!user || user.type !== 'user') {
    localStorage.removeItem(X_SESSION_UID_KEY)
    return null
  }
  return user
}

function setXSessionUser(user) {
  if (!user || user.type !== 'user') return
  localStorage.setItem(X_SESSION_UID_KEY, user.id)
}

function getXUserName(user) {
  return (user && (user.nick || user.name)) || '微信用户'
}

function getXUserHandle(user) {
  var account = user && user.identity && user.identity.account
  account = account ? String(account).replace(/^@+/, '') : ''
  return '@' + (account || getXUserName(user).replace(/\s+/g, '_') || 'User')
}

async function getXProfile(user) {
  var fallback = getXDefaultProfile(user)
  if (!user || user.id == null) return fallback
  var key = X_PROFILE_PREFIX + user.id
  try {
    if (window.db && db.config) {
      var row = await db.config.get(key)
      return normalizeXProfile(user, row && row.value)
    }
  } catch (e) {}
  try {
    var raw = localStorage.getItem(key)
    return normalizeXProfile(user, raw ? JSON.parse(raw) : null)
  } catch (e2) {
    return fallback
  }
}

async function saveXProfile(user, profile) {
  if (!user || user.id == null) return
  var normalized = normalizeXProfile(user, profile)
  var key = X_PROFILE_PREFIX + user.id
  try {
    if (window.db && db.config) {
      await db.config.put({ key: key, value: normalized })
      return
    }
  } catch (e) {}
  localStorage.setItem(key, JSON.stringify(normalized))
}

function getXDefaultProfile(user) {
  var join = getXDefaultJoinParts(user)
  return {
    backgroundImage: '',
    avatar: '',
    name: getXUserName(user),
    handle: stripXAt(getXUserHandle(user)),
    joinYear: join.year,
    joinMonth: join.month,
    following: '0',
    followers: '0'
  }
}

function normalizeXProfile(user, profile) {
  var base = getXDefaultProfile(user)
  if (!profile || typeof profile !== 'object') return base
  return {
    backgroundImage: profile.backgroundImage || '',
    avatar: profile.avatar || '',
    name: String(profile.name || base.name),
    handle: stripXAt(profile.handle || base.handle),
    joinYear: normalizeXJoinYear(profile.joinYear || base.joinYear, user),
    joinMonth: normalizeXJoinMonth(profile.joinMonth || base.joinMonth, user),
    following: normalizeXCount(profile.following),
    followers: normalizeXCount(profile.followers)
  }
}

function getXProfileName(user, profile) {
  return (profile && profile.name) || getXUserName(user)
}

function getXProfileHandle(user, profile) {
  var handle = profile && profile.handle ? profile.handle : getXUserHandle(user)
  return '@' + stripXAt(handle)
}

function getXProfileAvatarHTML(user, profile) {
  var name = getXProfileName(user, profile)
  var avatar = profile && profile.avatar ? profile.avatar : (user && user.avatar)
  if (avatar) return '<img src="' + xEscape(avatar) + '" alt="' + xEscape(name) + '">'
  return buildXDefaultAvatarHTML(name)
}

function stripXAt(value) {
  return String(value == null ? '' : value).trim().replace(/^@+/, '')
}

function normalizeXCount(value) {
  var str = String(value == null || value === '' ? '0' : value).trim()
  if (/^\d+$/.test(str)) return String(parseInt(str, 10))
  return str.replace(/[<>"'&]/g, '').slice(0, 12) || '0'
}

function pickXImage(callback) {
  if (window.showImagePicker) {
    window.showImagePicker(callback)
  } else if (window.toast) {
    window.toast('当前环境不支持选择图片')
  }
}

function getXDefaultJoinParts(user) {
  var ts = user && (user.createdAt || user.updatedAt || user.idCreatedAt)
  var date = ts ? new Date(ts) : new Date(2026, 2, 1)
  if (isNaN(date.getTime())) date = new Date(2026, 2, 1)
  return {
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1)
  }
}

function normalizeXJoinYear(value, user) {
  var fallback = getXDefaultJoinParts(user).year
  var year = parseInt(String(value == null ? '' : value).replace(/\D/g, ''), 10)
  if (!Number.isFinite(year) || year < 1900 || year > 2999) return fallback
  return String(year)
}

function normalizeXJoinMonth(value, user) {
  var fallback = getXDefaultJoinParts(user).month
  var month = parseInt(String(value == null ? '' : value).replace(/\D/g, ''), 10)
  if (!Number.isFinite(month) || month < 1 || month > 12) return fallback
  return String(month)
}

function getXJoinText(user, profile) {
  var year = normalizeXJoinYear(profile && profile.joinYear, user)
  var month = normalizeXJoinMonth(profile && profile.joinMonth, user)
  return '於 ' + year + '年' + month + '月加入'
}

function getXAvatarHTML(user) {
  var name = getXUserName(user)
  if (user && user.avatar) return '<img src="' + xEscape(user.avatar) + '" alt="' + xEscape(name) + '">'
  return buildXDefaultAvatarHTML(name)
}

function buildXDefaultAvatarHTML(name) {
  return '<span class="x-avatar-placeholder">' + xEscape((name || '我').slice(0, 1)) + '</span>'
}

function getXWeChatSvg() {
  return '<svg class="x-login-wechat-svg" viewBox="0 0 576 512" aria-hidden="true"><path d="M385.2 167.6c6.4 0 12.6.3 18.8 1.1C387.4 90.3 303.3 32 207.7 32 100.5 32 13 104.8 13 197.4c0 53.4 29.3 97.5 77.9 131.6l-19.3 58.6 68.1-34.1c24.4 4.8 43.8 9.7 68.2 9.7 6.2 0 12.1-.3 18.3-.8-3.9-12.9-6.2-26.6-6.2-40.8-.1-84.9 72.9-154 165.2-154zM280.7 114.7c14.5 0 24.2 9.7 24.2 24.4 0 14.5-9.7 24.2-24.2 24.2-14.8 0-29.3-9.7-29.3-24.2.1-14.7 14.6-24.4 29.3-24.4zm-136.4 48.6c-14.5 0-29.3-9.7-29.3-24.2 0-14.8 14.8-24.4 29.3-24.4 14.8 0 24.4 9.7 24.4 24.4 0 14.6-9.6 24.2-24.4 24.2zM563 319.4c0-77.9-77.9-141.3-165.4-141.3-92.7 0-165.4 63.4-165.4 141.3s72.8 141.3 165.4 141.3c19.3 0 38.9-5.1 58.6-9.9l53.4 29.3-14.8-48.6C534 402.1 563 363.2 563 319.4zM343.9 294.9c-9.7 0-19.3-9.7-19.3-19.4 0-9.9 9.7-19.6 19.3-19.6 14.8 0 24.4 9.7 24.4 19.6 0 9.7-9.6 19.4-24.4 19.4zm107.1 0c-9.7 0-19.3-9.7-19.3-19.4 0-9.9 9.7-19.6 19.3-19.6 14.8 0 24.4 9.7 24.4 19.6.1 9.7-9.5 19.4-24.4 19.4z"></path></svg>'
}

function xEscape(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, function(ch) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]
  })
}

function formatXNumber(n) {
  if (typeof n === 'string') return n
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万'
  return String(n)
}

function formatXContent(str) {
  return xEscape(str)
    .replace(/(#[A-Za-z0-9_\u4e00-\u9fa5]+)/g, '<span class="x-hashtag">$1</span>')
    .replace(/\n/g, '<br>')
}

function getXHeartSvg(solid) {
  return solid
    ? '<svg viewBox="0 0 24 24"><g><path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"></path></g></svg>'
    : '<svg viewBox="0 0 24 24"><g><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"></path></g></svg>'
}

function buildXPost(data) {
  var contentHTML = formatXContent(data.content)
  var avatarHTML = data.avatar
    ? '<img src="' + xEscape(data.avatar) + '" alt="">'
    : buildXDefaultAvatarHTML(data.name || '')
  var isLocked = !!data.image && !!data.locked && !data.unlocked
  var imageHTML = !data.image
    ? ''
    : isLocked
      ? '<div class="x-post-image x-post-image-locked">' +
          '<img src="' + xEscape(data.image) + '" alt="" loading="lazy">' +
          '<div class="x-post-lock-overlay">' +
            '<i class="fa-solid fa-lock"></i>' +
            '<div class="x-post-lock-text">订阅可见内容</div>' +
            '<button type="button" class="x-post-unlock-btn" data-action="unlock">解锁查看</button>' +
          '</div>' +
        '</div>'
      : '<div class="x-post-image"><img src="' + xEscape(data.image) + '" alt="" loading="lazy"></div>'
  var quoteHTML = data.quote
    ? '<div class="x-post-quote">' +
        '<div class="x-post-quote-header">' +
          '<div class="x-post-quote-avatar">' +
            (data.quote.avatar
              ? '<img src="' + xEscape(data.quote.avatar) + '" alt="">'
              : buildXDefaultAvatarHTML(data.quote.name || '')) +
          '</div>' +
          '<span class="x-post-quote-name">' + xEscape(data.quote.name || '') + '</span>' +
          '<span class="x-post-quote-handle">' + xEscape(data.quote.handle || '') + '</span>' +
        '</div>' +
        '<div class="x-post-quote-content">' + formatXContent(data.quote.content || '') + '</div>' +
      '</div>'
    : ''
  var liked = !!data.liked
  var timeLabel = data.time || (data.createdAt ? formatXRelativeTime(data.createdAt) : '')

  return '<div class="x-post" data-post-id="' + xEscape(data.id || '') + '">' +
    '<div class="x-post-avatar">' + avatarHTML + '</div>' +
    '<div class="x-post-body">' +
      '<div class="x-post-header">' +
        '<span class="x-post-name">' + xEscape(data.name) + '</span>' +
        (data.verified ?
          '<span class="x-post-verified"><svg viewBox="0 0 24 24"><g><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"></path></g></svg></span>' : '') +
        '<span class="x-post-handle">' + xEscape(data.handle) + '</span>' +
        '<span class="x-post-dot">·</span>' +
        '<span class="x-post-time">' + xEscape(timeLabel) + '</span>' +
        '<span class="x-post-more"><svg viewBox="0 0 24 24"><g><path d="M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm7 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"></path></g></svg></span>' +
      '</div>' +
      '<div class="x-post-content">' + contentHTML + '</div>' +
      imageHTML +
      quoteHTML +
      '<div class="x-post-actions">' +
        '<button class="x-post-action comment" data-action="comment"><svg viewBox="0 0 24 24"><g><path d="M1.751 10c0-4.42 3.584-8.005 8.005-8.005h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.005zm8.005-6.005c-3.317 0-6.005 2.69-6.005 6.005 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"></path></g></svg><span>' + formatXNumber(data.comments) + '</span></button>' +
        '<button class="x-post-action retweet" data-action="retweet"><svg viewBox="0 0 24 24"><g><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.791-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.791 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"></path></g></svg><span>' + formatXNumber(data.retweets) + '</span></button>' +
        '<button class="x-post-action like' + (liked ? ' liked' : '') + '" data-action="like" data-count="' + Number(data.likes || 0) + '" data-base-count="' + Number(data.likes || 0) + '" data-liked="' + (liked ? '1' : '0') + '">' + getXHeartSvg(liked) + '<span>' + formatXNumber(data.likes) + '</span></button>' +
        '<button class="x-post-action views" data-action="views"><svg viewBox="0 0 24 24"><g><path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10H6v10H4zm9.248 0v-7h2v7h-2z"></path></g></svg><span>' + formatXNumber(data.views) + '</span></button>' +
        '<button class="x-post-action bookmark" data-action="bookmark"><svg viewBox="0 0 24 24"><g><path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z"></path></g></svg></button>' +
        '<button class="x-post-action share" data-action="share"><svg viewBox="0 0 24 24"><g><path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.29 3.3-1.42-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z"></path></g></svg></button>' +
      '</div>' +
    '</div>' +
  '</div>'
}

function buildXBottomBar() {
  var items = [
    {
      id: 'home',
      active: true,
      defaultSvg: '<svg viewBox="0 0 24 24"><g><path d="M21.591 7.146L12.52 1.157c-.316-.21-.724-.21-1.04 0l-9.071 5.99c-.26.173-.409.456-.409.757v13.183c0 .502.418.913.929.913h6.638c.511 0 .929-.41.929-.913v-7.075h3.008v7.075c0 .502.418.913.929.913h6.638c.511 0 .929-.41.929-.913V7.904c0-.301-.158-.584-.408-.758zM20 20l-4.5.01v-7.09c0-.5-.418-.91-.929-.91H9.43c-.511 0-.929.41-.929.91L8.5 20H4V8.773l8-5.27 8 5.271V20z"></path></g></svg>',
      activeSvg: '<svg viewBox="0 0 24 24"><g><path d="M21.591 7.146L12.52 1.157c-.316-.21-.724-.21-1.04 0l-9.071 5.99c-.26.173-.409.456-.409.757v13.183c0 .502.418.913.929.913H9.14c.511 0 .929-.41.929-.913v-7.075h3.862v7.075c0 .502.418.913.929.913h6.141c.511 0 .929-.41.929-.913V7.904c0-.301-.158-.584-.408-.758z"></path></g></svg>'
    },
    {
      id: 'search',
      active: false,
      defaultSvg: '<svg viewBox="0 0 24 24"><g><path d="M10.25 3.75c-3.59 0-6.5 2.91-6.5 6.5s2.91 6.5 6.5 6.5c1.795 0 3.419-.726 4.596-1.904 1.178-1.177 1.904-2.801 1.904-4.596 0-3.59-2.91-6.5-6.5-6.5zm-8.5 6.5c0-4.694 3.806-8.5 8.5-8.5s8.5 3.806 8.5 8.5c0 1.986-.682 3.815-1.824 5.262l4.781 4.781-1.414 1.414-4.781-4.781c-1.447 1.142-3.276 1.824-5.262 1.824-4.694 0-8.5-3.806-8.5-8.5z"></path></g></svg>',
      activeSvg: '<svg viewBox="0 0 24 24"><g><path d="M10.25 3.75c-3.59 0-6.5 2.91-6.5 6.5s2.91 6.5 6.5 6.5c1.795 0 3.419-.726 4.596-1.904 1.178-1.177 1.904-2.801 1.904-4.596 0-3.59-2.91-6.5-6.5-6.5zm-8.5 6.5c0-4.694 3.806-8.5 8.5-8.5s8.5 3.806 8.5 8.5c0 1.986-.682 3.815-1.824 5.262l4.781 4.781-1.414 1.414-4.781-4.781c-1.447 1.142-3.276 1.824-5.262 1.824-4.694 0-8.5-3.806-8.5-8.5z" stroke="currentColor" stroke-width="1.5"></path></g></svg>'
    },
    {
      id: 'notifications',
      active: false,
      defaultSvg: '<svg viewBox="0 0 24 24"><g><path d="M19.993 9.042C19.48 5.017 16.054 2 11.996 2s-7.49 3.021-7.999 7.051L2.866 18H7.1c.463 2.282 2.481 4 4.9 4s4.435-1.718 4.9-4h4.236l-1.143-8.958zM12 20c-1.306 0-2.417-.835-2.829-2h5.658c-.412 1.165-1.523 2-2.829 2zm-6.866-4l.847-6.698C6.364 6.272 8.941 4 11.996 4s5.627 2.268 6.013 5.295L18.858 16H5.134z"></path></g></svg>',
      activeSvg: '<svg viewBox="0 0 24 24"><g><path d="M11.996 2c-4.062 0-7.49 3.021-7.999 7.051L2.866 18H7.1c.463 2.282 2.481 4 4.9 4s4.435-1.718 4.9-4h4.236l-1.143-8.958C19.48 5.017 16.054 2 11.996 2zM9.171 18h5.658c-.412 1.165-1.523 2-2.829 2s-2.417-.835-2.829-2z"></path></g></svg>'
    },
    {
      id: 'messages',
      active: false,
      defaultSvg: '<svg viewBox="0 0 24 24"><g><path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v2.764l8 5.333 8-5.333V5.5c0-.276-.224-.5-.5-.5h-15zm15.5 5.463l-8 5.334-8-5.334V18.5c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-8.037z"></path></g></svg>',
      activeSvg: '<svg viewBox="0 0 24 24"><g><path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v2.764l8 5.333 8-5.333V5.5c0-.276-.224-.5-.5-.5h-15zm15.5 5.463l-8 5.334-8-5.334V18.5c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-8.037z" stroke="currentColor" stroke-width="1"></path></g></svg>'
    }
  ]

  return items.map(function(item) {
    return '<div class="x-bottombar-item' + (item.active ? ' active' : '') + '" data-tab="' + item.id + '">' +
      '<span class="icon-default">' + item.defaultSvg + '</span>' +
      '<span class="icon-active">' + item.activeSvg + '</span>' +
    '</div>'
  }).join('')
}

// ================= 帖子数据存储 =================

async function getXFeed(user) {
  if (!user || user.id == null) return []
  var key = X_FEED_PREFIX + user.id
  try {
    if (window.db && db.config) {
      var row = await db.config.get(key)
      if (row && Array.isArray(row.value)) return row.value
    }
  } catch (e) {}

  // 首次进入用一条演示动态占位，避免空白
  var seed = [{
    id: 'seed-1',
    authorId: null,
    name: '弯弯协会',
    verified: true,
    handle: '@Wanwan_Offical',
    avatar: 'img/wanwan.png',
    content: '产品上线请多多关注。#AI #Wanwan',
    image: '',
    createdAt: Date.now() - 2 * 3600 * 1000,
    time: '2小时',
    comments: 847,
    retweets: 203,
    likes: 3654,
    liked: false,
    views: '28.6万'
  }]
  await saveXFeed(user, seed)
  return seed
}

async function saveXFeed(user, feed) {
  if (!user || user.id == null) return
  var key = X_FEED_PREFIX + user.id
  try {
    if (window.db && db.config) {
      await db.config.put({ key: key, value: feed })
    }
  } catch (e) {
    console.error('保存 X 动态失败：', e)
  }
}

async function getXPostComments(user, postId) {
  if (!user || user.id == null) return []
  var key = X_COMMENTS_PREFIX + user.id + '_' + postId
  try {
    if (window.db && db.config) {
      var row = await db.config.get(key)
      if (row && Array.isArray(row.value)) return row.value
    }
  } catch (e) {}
  return []
}

async function saveXPostComments(user, postId, comments) {
  if (!user || user.id == null) return
  var key = X_COMMENTS_PREFIX + user.id + '_' + postId
  try {
    if (window.db && db.config) {
      await db.config.put({ key: key, value: comments })
    }
  } catch (e) {
    console.error('保存 X 评论失败：', e)
  }
}

function genXPostId() {
  return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function formatXRelativeTime(ts) {
  if (!ts) return ''
  var diff = Math.max(0, Date.now() - ts)
  var min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return min + '分钟'
  var hr = Math.floor(min / 60)
  if (hr < 24) return hr + '小时'
  var day = Math.floor(hr / 24)
  if (day < 7) return day + '天'
  var d = new Date(ts)
  return (d.getMonth() + 1) + '月' + d.getDate() + '日'
}

async function getXAvailableCharacters() {
  if (!window.db || !db.characters) return []
  try {
    return await db.characters.where('type').anyOf(['char', 'npc']).toArray()
  } catch (e) {
    return (await db.characters.toArray()).filter(function(c) { return c.type === 'char' || c.type === 'npc' })
  }
}

// ================= 读取微信近期聊天记录，作为 AI 上下文（与 Instagram 一致的机制） =================

async function findXCharChat(ownerUid, charId) {
  try {
    return await db.chats.where('[ownerUid+charId]').equals([ownerUid, charId]).first()
  } catch (e) {
    var rows = await db.chats.where('charId').equals(charId).toArray()
    return rows.find(function(row) { return parseInt(row.ownerUid) === ownerUid })
  }
}

function formatXPromptTime(ts) {
  var date = new Date(ts || Date.now())
  if (Number.isNaN(date.getTime())) date = new Date()
  var pad = function(n) { return String(n).padStart(2, '0') }
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes())
}

function stripXStatusTag(content) {
  return String(content || '').replace(/<status>[\s\S]*?<\/status>/i, '').trim()
}

function normalizeXChatMessageForPrompt(msg, user, char, source) {
  if (!msg) return null
  if (msg.type === 'image') return null
  var content = String(msg.content || '').trim()
  if (!content) return null
  var parsed = typeof parseMsgType === 'function' ? parseMsgType(content, '') : null
  if (parsed && (parsed.type === 'real-photo' || parsed.type === 'image')) return null
  if (/^__IMG__/.test(content)) return null
  var sender = msg.role === 'user' ? getXUserName(user) : (char.nick || char.name || '角色')
  var clean = source === 'miss-you' ? stripXStatusTag(content) : content
  clean = clean.replace(/\s+/g, ' ').trim()
  if (!clean) return null
  return { createdAt: msg.createdAt || 0, sender: sender, content: clean.slice(0, 500) }
}

async function buildXRecentChatContextForChar(ownerUid, user, char, limit) {
  var chat = await findXCharChat(ownerUid, char.id)
  if (!chat) return ''
  var rows = []
  try {
    var online = await db.messages.where('chatId').equals(chat.id).sortBy('createdAt')
    online.forEach(function(m) {
      var normalized = normalizeXChatMessageForPrompt(m, user, char, 'wechat')
      if (normalized) rows.push(normalized)
    })
  } catch (e2) {}
  if (db.offlineChats) {
    try {
      var offline = await db.offlineChats.where('charId').equals(char.id).toArray()
      offline
        .filter(function(m) { return parseInt(m.ownerUid) === ownerUid && parseInt(m.chatId) === parseInt(chat.id) })
        .forEach(function(m) {
          var normalized = normalizeXChatMessageForPrompt(m, user, char, 'miss-you')
          if (normalized) rows.push(normalized)
        })
    } catch (e3) {}
  }
  rows = rows
    .filter(function(row) { return row.content })
    .sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0) })
    .slice(-(limit || 20))
  if (!rows.length) return ''
  var charName = char.nick || char.name || '角色'
  return '【' + charName + ' 的近期微信聊天记录】\n' + rows.map(function(row) {
    return '[' + formatXPromptTime(row.createdAt) + '] ' + row.sender + ': ' + row.content
  }).join('\n')
}

async function buildXRecentChatContextMap(user, chars) {
  var map = {}
  if (!window.db || !db.chats || !db.messages || !Array.isArray(chars) || !chars.length) return map
  var ownerUid = user && user.id ? parseInt(user.id) : null
  if (!Number.isFinite(ownerUid)) return map
  for (var i = 0; i < chars.length; i++) {
    try {
      var block = await buildXRecentChatContextForChar(ownerUid, user, chars[i], 20)
      if (block) map[chars[i].id] = block
    } catch (e) {}
  }
  return map
}

// 指定角色在 X 上必须使用的语言（目前仅按名字匹配 Tony；以后可以改成读取角色专属设置）
function getXCharacterLanguageNote(c) {
  var name = String((c && (c.nick || c.name)) || '').toLowerCase()
  if (name.indexOf('tony') !== -1) {
    return '\n  【语言要求·最高优先级】该角色在 X 上发布的所有推文和评论必须使用英文（English）撰写，不需要附带中文翻译，禁止使用中文。'
  }
  return ''
}

// ================= 角色关系强度（用于评论区出场权重） =================
function getXRelationText(char, targetCharId) {
  if (targetCharId == null) return '(未设定)'
  var rels = char && Array.isArray(char.relations) ? char.relations : []
  var rel = rels.find(function(r) { return String(r.charId) === String(targetCharId) })
  if (!rel) return '(未设定)'
  return (rel.type || '关系') + (rel.desc ? '（' + rel.desc + '）' : '')
}

// ================= 粉丝量级（按角色类型缩放互动数据，不是所有账号一个流量级别） =================
function getXEngagementScale(authorChar) {
  if (authorChar && authorChar.type === 'char') {
    // 主角色：网红/名人级账号
    return { likes: [2000, 30000], comments: [100, 1500], retweets: [50, 2000], views: [20000, 300000] }
  }
  if (authorChar && authorChar.type === 'npc') {
    // NPC：普通活跃用户
    return { likes: [50, 800], comments: [5, 60], retweets: [0, 40], views: [1000, 8000] }
  }
  // 路人：小透明账号
  return { likes: [0, 500], comments: [0, 40], retweets: [0, 30], views: [500, 5000] }
}

function xRandomInRange(range) {
  var min = range[0], max = range[1]
  return min + Math.floor(Math.random() * (max - min + 1))
}

// ================= 供微信聊天读取「最近 X 动态」（与 IG→微信 的方向相反，打通反方向） =================
// 直接读 db.config，不走 getXFeed，避免对从未用过 X 的用户触发首次访问的演示数据播种
window.getXActivityContextForChar = async function(user, char, limit) {
  limit = limit || 10
  if (!user || user.id == null || !char) return ''
  try {
    if (!window.db || !db.config) return ''
    var row = await db.config.get(X_FEED_PREFIX + user.id)
    var feed = (row && Array.isArray(row.value)) ? row.value : []
    if (!feed.length) return ''
    var relevant = feed
      .filter(function(p) { return p.authorId === char.id || p.authorId === user.id })
      .slice(0, limit)
    if (!relevant.length) return ''
    var charName = char.nick || char.name || '角色'
    var userName = getXUserName(user)
    return '【X（Twitter）最近动态，仅供参考，角色不一定已经看到】\n' + relevant.map(function(p) {
      var who = p.authorId === user.id ? userName : charName
      var t = p.time || formatXRelativeTime(p.createdAt)
      return '[' + t + '] ' + who + ' 发布: ' + p.content
    }).join('\n')
  } catch (e) {
    return ''
  }
}

function parseXJsonArray(raw) {
  if (!raw) return []
  var text = String(raw).trim()
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '')
  try {
    var parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed
    if (parsed && Array.isArray(parsed.items)) return parsed.items
  } catch (e) {}
  var match = text.match(/\[[\s\S]*\]/)
  if (match) {
    try {
      var parsed2 = JSON.parse(match[0])
      if (Array.isArray(parsed2)) return parsed2
    } catch (e2) {}
  }
  return []
}

// 部分模型会在 JSON 字符串里直接写 HTML 实体（比如把撇号写成 &#39;），这里统一解码一次，避免显示成字面字符
function decodeXHtmlEntities(str) {
  return String(str || '')
    .replace(/&#39;|&#x27;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
}

// ================= 弹窗工具 =================

function openXCenterModal(html) {
  var app = document.getElementById('app') || document.body
  var overlay = typeof createOverlay === 'function' ? createOverlay() : document.createElement('div')
  overlay.className = overlay.className || 'sheet-overlay'
  var sheet = typeof createSheet === 'function' ? createSheet(html) : document.createElement('div')
  if (typeof createSheet !== 'function') {
    sheet.className = 'center-modal'
    sheet.innerHTML = html
  }
  overlay.style.zIndex = '10030'
  sheet.style.zIndex = '10031'
  app.appendChild(overlay)
  app.appendChild(sheet)
  requestAnimationFrame(function() {
    overlay.classList.add('show')
    sheet.classList.add('show')
  })
  function close() {
    overlay.classList.remove('show')
    sheet.classList.remove('show')
    setTimeout(function() { overlay.remove(); sheet.remove() }, 250)
  }
  overlay.addEventListener('click', close)
  return { overlay: overlay, sheet: sheet, close: close }
}

function showXGeneratingModal(title) {
  var modal = openXCenterModal(
    '<div class="sheet-title">' + xEscape(title || '生成中') + '</div>' +
    '<div class="x-generate-loading">' +
      '<i class="fa fa-spinner fa-spin"></i>' +
      '<span id="x-generate-status">准备生成...</span>' +
    '</div>'
  )
  return {
    setStatus: function(text) {
      var el = modal.sheet.querySelector('#x-generate-status')
      if (el) el.textContent = text
    },
    close: modal.close
  }
}

// ================= Feed 互动绑定（首页与详情页共用） =================

function bindXFeedEvents(page, user, options) {
  options = options || {}
  var scope = page.querySelector('#x-feed-list') || page

  scope.querySelectorAll('.x-post').forEach(function(postEl) {
    if (options.noNavigate) return
    postEl.addEventListener('click', async function(e) {
      if (e.target.closest('.x-post-actions')) return
      if (e.target.closest('.x-post-unlock-btn')) return
      var id = postEl.dataset.postId
      if (!id) return
      var feed = await getXFeed(user)
      var post = feed.find(function(p) { return String(p.id) === String(id) })
      if (post) showXPostDetail(user, post)
    })
  })

  scope.querySelectorAll('.x-post-unlock-btn').forEach(function(button) {
    button.addEventListener('click', async function(e) {
      e.preventDefault()
      e.stopPropagation()
      var postEl = button.closest('.x-post')
      var id = postEl && postEl.dataset.postId
      if (!id) return
      var feed = await getXFeed(user)
      var post = feed.find(function(p) { return String(p.id) === String(id) })
      if (!post) return
      post.unlocked = true
      await saveXFeed(user, feed)
      var wrap = postEl.querySelector('.x-post-image')
      if (wrap) wrap.outerHTML = '<div class="x-post-image"><img src="' + xEscape(post.image) + '" alt="" loading="lazy"></div>'
    })
  })

  scope.querySelectorAll('.x-post-action.like').forEach(function(button) {
    button.addEventListener('click', async function(e) {
      e.preventDefault()
      e.stopPropagation()
      var postEl = button.closest('.x-post')
      var id = postEl && postEl.dataset.postId
      if (!id) return
      var feed = await getXFeed(user)
      var post = feed.find(function(p) { return String(p.id) === String(id) })
      if (!post) return
      post.liked = !post.liked
      post.likes = Math.max(0, Number(post.likes || 0) + (post.liked ? 1 : -1))
      await saveXFeed(user, feed)
      button.dataset.liked = post.liked ? '1' : '0'
      button.classList.toggle('liked', post.liked)
      button.innerHTML = getXHeartSvg(post.liked) + '<span>' + formatXNumber(post.likes) + '</span>'
    })
  })

  scope.querySelectorAll('.x-post-more').forEach(function(moreBtn) {
    moreBtn.addEventListener('click', function(e) {
      e.preventDefault()
      e.stopPropagation()
      var postEl = moreBtn.closest('.x-post')
      var id = postEl && postEl.dataset.postId
      if (!id) return
      showXPostActionSheet(user, id, options)
    })
  })
}

function showXPostActionSheet(user, postId, options) {
  options = options || {}
  var modal = openXCenterModal(
    '<div class="sheet-title">帖子操作</div>' +
    '<div class="x-post-action-sheet-body">' +
      '<button class="btn-pill btn-full x-post-action-delete" id="x-post-action-delete" type="button">删除帖子</button>' +
      '<button class="btn-ghost btn-pill btn-full" id="x-post-action-cancel" type="button">取消</button>' +
    '</div>'
  )
  modal.sheet.querySelector('#x-post-action-cancel').addEventListener('click', modal.close)
  modal.sheet.querySelector('#x-post-action-delete').addEventListener('click', async function() {
    modal.close()
    await deleteXPost(user, postId)
    window.toast && window.toast('已删除')
    if (options.onDeleted) {
      await options.onDeleted()
    } else {
      await renderXPage(user)
    }
  })
}

async function deleteXPost(user, postId) {
  var feed = await getXFeed(user)
  var next = feed.filter(function(p) { return String(p.id) !== String(postId) })
  await saveXFeed(user, next)
  await deleteXPostComments(user, postId)
}

async function deleteXPostComments(user, postId) {
  if (!user || user.id == null) return
  var key = X_COMMENTS_PREFIX + user.id + '_' + postId
  try {
    if (window.db && db.config) await db.config.delete(key)
  } catch (e) {}
}

// ================= 生成动态（AI 填充时间线） =================

window.showXGenerateSheet = async function() {
  var user = await getXSessionUser()
  if (!user) return
  var chars = await getXAvailableCharacters()
  var imagePref = await getXGenImagePref(user)

  var charsHTML = chars.length
    ? chars.map(function(c) {
        return '<label class="x-gen-char-row"><input type="checkbox" class="x-gen-char-cb" value="' + c.id + '" checked><span>' + xEscape(c.nick || c.name) + '</span></label>'
      }).join('')
    : '<div class="x-gen-empty-chars">暂无已建角色，将全部生成路人推文</div>'

  var modal = openXCenterModal(
    '<div class="sheet-title">生成动态</div>' +
    '<div class="x-generate-sub">选择参与发帖的角色（不选则全部为路人推文）</div>' +
    '<div class="x-gen-char-list">' + charsHTML + '</div>' +
    '<div class="x-gen-count-row"><span>生成数量</span><input type="number" id="x-gen-count" value="6" min="1" max="20" class="input-field x-gen-count-input"></div>' +
    '<label class="x-gen-char-row"><input type="checkbox" id="x-gen-image-toggle"' + (imagePref ? ' checked' : '') + '><span>为推文生成配图</span></label>' +
    '<div class="sheet-actions">' +
      '<button class="btn-ghost btn-pill" id="x-gen-cancel" type="button">取消</button>' +
      '<button class="btn-pill btn-full" id="x-gen-confirm" type="button">生成</button>' +
    '</div>'
  )

  modal.sheet.querySelector('#x-gen-cancel').addEventListener('click', modal.close)
  modal.sheet.querySelector('#x-gen-confirm').addEventListener('click', async function() {
    var selectedIds = [].slice.call(modal.sheet.querySelectorAll('.x-gen-char-cb:checked')).map(function(cb) { return parseInt(cb.value, 10) })
    var countInput = modal.sheet.querySelector('#x-gen-count')
    var count = parseInt(countInput && countInput.value, 10) || 6
    var allowImages = !!(modal.sheet.querySelector('#x-gen-image-toggle') || {}).checked
    modal.close()
    await saveXGenImagePref(user, allowImages)
    await generateXFeedPosts(user, selectedIds, count, allowImages)
  })
}

async function generateXFeedPosts(user, charIds, count, allowImages) {
  if (!window.callAI) {
    window.toast && window.toast('请先配置 API')
    return
  }
  var loading = showXGeneratingModal('生成动态')
  try {
    loading.setStatus('正在整理角色信息...')
    var allChars = await getXAvailableCharacters()
    var chars = charIds && charIds.length
      ? allChars.filter(function(c) { return charIds.indexOf(c.id) !== -1 })
      : []
    loading.setStatus('正在读取最近的微信聊天记录...')
    var chatContextMap = await buildXRecentChatContextMap(user, chars)
    var charBlock = chars.length
      ? chars.map(function(c) {
          var base = '- ' + (c.nick || c.name) + '（id:' + c.id + '）：' + String(c.description || '无设定').slice(0, 300)
          var chat = chatContextMap[c.id]
          if (chat) base += '\n  ' + chat.replace(/\n/g, '\n  ')
          base += getXCharacterLanguageNote(c)
          return base
        }).join('\n')
      : '（未指定角色，全部生成路人推文，authorId 为 null）'

    var existingFeed = await getXFeed(user)
    var quotableList = existingFeed.slice(0, 10).map(function(p) {
      return { name: p.name, handle: p.handle, avatar: p.avatar || '', content: String(p.content || '').slice(0, 140), image: '' }
    })
    var quotableBlock = quotableList.length
      ? quotableList.map(function(q, idx) { return idx + '. ' + q.name + '：' + q.content }).join('\n')
      : '（暂无可引用的历史推文）'

    var prompt =
      '你正在为一个模拟 X（Twitter）平台生成时间线内容。\n\n' +
      '【参与角色】\n' + charBlock + '\n\n' +
      '【可供转发引用的历史推文（编号）】\n' + quotableBlock + '\n\n' +
      '【任务】生成 ' + count + ' 条推文，语气自然、简短、符合社交平台风格，可以有梗、有生活化内容、允许少量话题标签（用 # 开头）。\n' +
      '如果角色有"近期微信聊天记录"，可以在合适的地方自然呼应或提及最近聊过的内容（比如刚聊完的话题、心情），增强连续性，但不要每条都提、也不要生硬复述。\n' +
      '如果某个角色标注了【语言要求】，该角色的每一条推文都必须严格使用指定语言撰写，优先级高于其他所有规则，不能违反。\n' +
      '如果某条推文属于上面列出的角色，authorId 必须填该角色的 id（数字）；否则视为路人推文，authorId 填 null，author 用随机中文或英文网名。\n' +
      '禁止生成用户本人（' + getXUserName(user) + '）发的推文。\n' +
      '如果某条推文带图且内容明显是福利/网黄向内容，可以偶尔（不要太频繁，几条里最多1条）把 locked 设为 true，表示这是一条"订阅可见"的付费专属内容，配图会被打码，文案可以配合写成"订阅解锁""专属福利"这类引导语气；其余情况 locked 一律为 false。\n' +
      '可以让个别推文变成"转发锐评"（quote tweet）：从上面【可供转发引用的历史推文】里选一条，把它的编号填进 quoteOfIndex，content 写这条转发时附带的锐评/吐槽/玩梗，不要复述原文内容。没有转发的推文 quoteOfIndex 填 null。转发的比例不用高，几条里有1条左右即可，如果历史推文列表是空的就不要转发。\n\n' +
      '严格只返回 JSON 数组，不要 Markdown 代码块，不要任何解释文字。每条格式：\n' +
      '{"authorId": 数字或null, "author": "作者昵称", "content": "推文正文", "hasImage": true或false, "imageDesc": "若hasImage为true，用于生成配图的简短英文描述", "locked": true或false, "quoteOfIndex": 数字或null}'

    loading.setStatus('AI 正在生成推文...')
    var raw = await window.callAI([{ role: 'user', content: prompt }], { temperature: 0.9 })
    var items = parseXJsonArray(raw)
    if (!items.length) throw new Error('生成结果为空，请重试')

    var feed = await getXFeed(user)
    for (var i = 0; i < items.length; i++) {
      loading.setStatus('正在整理第 ' + (i + 1) + '/' + items.length + ' 条...')
      var item = items[i] || {}
      item.content = decodeXHtmlEntities(item.content)
      var authorId = (item.authorId != null && item.authorId !== "" && !isNaN(Number(item.authorId))) ? Number(item.authorId) : null
      var authorChar = authorId != null ? chars.find(function(c) { return c.id === authorId }) : null
      var image = ''
      if (item.hasImage && allowImages !== false) {
        image = await generateXPostImage(item.imageDesc || item.content || '', i)
      }
      var authorAccount = authorChar && authorChar.identity && authorChar.identity.account
      var scale = getXEngagementScale(authorChar)
      var quote = (item.quoteOfIndex != null && quotableList[item.quoteOfIndex]) ? quotableList[item.quoteOfIndex] : null
      feed.unshift({
        id: genXPostId(),
        authorId: authorChar ? authorChar.id : null,
        name: authorChar ? (authorChar.nick || authorChar.name) : (item.author || 'X用户'),
        handle: '@' + (authorAccount || (authorChar ? (authorChar.nick || authorChar.name) : (item.author || 'user'))).toString().replace(/\s+/g, '_'),
        avatar: authorChar ? (authorChar.avatar || '') : '',
        verified: !!authorChar,
        content: item.content || '',
        image: image,
        locked: !!(item.locked && image),
        unlocked: false,
        quote: quote,
        createdAt: Date.now() - i * 60000,
        time: i === 0 ? '刚刚' : (i + '分钟'),
        comments: xRandomInRange(scale.comments),
        retweets: xRandomInRange(scale.retweets),
        likes: xRandomInRange(scale.likes),
        liked: false,
        views: xRandomInRange(scale.views)
      })
    }
    await saveXFeed(user, feed)
    loading.close()
    await renderXPage(user)
    window.toast && window.toast('已生成 ' + items.length + ' 条动态')
  } catch (e) {
    loading.close()
    console.error('生成 X 动态失败：', e)
    window.toast && window.toast('生成失败：' + (e.message || e))
  }
}

function generateXPostImage(prompt, index) {
  if (window.generateImage) {
    return window.generateImage('X (Twitter) post photo, candid, natural lighting, realistic. ' + prompt, { size: '1024x1024' }).catch(function(e) {
      console.warn('X 图片生成失败，跳过配图：', e)
      return ''
    })
  }
  return Promise.resolve('')
}

// ================= 帖子详情 + 生成评论 =================

async function showXPostDetail(user, post) {
  var existing = document.getElementById('x-detail-page')
  if (existing) existing.remove()

  var comments = await getXPostComments(user, post.id)

  var page = document.createElement('div')
  page.id = 'x-detail-page'
  page.className = 'full-page x-detail-page'
  page.dataset.postId = post.id

  page.innerHTML =
    '<div class="page-header">' +
      '<button class="header-back" id="x-detail-back" type="button"><i class="fa fa-angle-left"></i></button>' +
      '<span class="header-title">帖子</span>' +
      '<button class="btn-icon" id="x-detail-generate" type="button" title="生成评论"><i class="fa-solid fa-wand-magic-sparkles"></i></button>' +
    '</div>' +
    '<div class="x-detail-scroll" id="x-feed-list">' +
      buildXPost(post) +
      '<div class="x-detail-comments-title">评论</div>' +
      '<div class="x-detail-comments" id="x-detail-comments">' +
        (comments.length
          ? renderXCommentsHTML(comments)
          : '<div class="x-detail-comments-empty">暂无评论<br><button class="btn-ghost btn-sm" id="x-detail-generate-inline" type="button">生成评论</button></div>') +
      '</div>' +
    '</div>' +
    '<div class="x-detail-composer">' +
      '<div class="x-detail-reply-target" id="x-detail-reply-target" hidden>' +
        '<span>回复 @<span id="x-detail-reply-target-name"></span></span>' +
        '<button type="button" id="x-detail-reply-cancel" aria-label="取消回复"><i class="fa fa-times"></i></button>' +
      '</div>' +
      '<div class="x-detail-composer-row">' +
        '<input type="text" id="x-detail-comment-input" class="x-detail-comment-input" placeholder="发布你的回复" maxlength="280">' +
        '<button type="button" id="x-detail-comment-send" class="x-detail-comment-send-btn">发送</button>' +
      '</div>' +
    '</div>'

  if (window.openPage) {
    window.openPage(page)
  } else {
    var app = document.getElementById('app') || document.body
    app.appendChild(page)
  }

  var backBtn = page.querySelector('#x-detail-back')
  if (backBtn) {
    backBtn.addEventListener('click', function() {
      if (window.closePage) window.closePage('x-detail-page')
      else page.remove()
    })
  }

  var genBtn = page.querySelector('#x-detail-generate')
  if (genBtn) genBtn.addEventListener('click', function() { generateXPostComments(user, post) })
  var genInline = page.querySelector('#x-detail-generate-inline')
  if (genInline) genInline.addEventListener('click', function() { generateXPostComments(user, post) })

  bindXDetailComposer(page, user, post)

  bindXFeedEvents(page, user, {
    noNavigate: true,
    onDeleted: async function() {
      await renderXPage(user)
      if (window.closePage) window.closePage('x-detail-page')
      else page.remove()
    }
  })
}

function renderXCommentsHTML(comments) {
  return comments.map(function(c) {
    var avatarHTML = c.avatar
      ? '<img src="' + xEscape(c.avatar) + '" alt="">'
      : buildXDefaultAvatarHTML(c.author || '')
    var replyHTML = c.replyToAuthor
      ? '<div class="x-comment-reply-to">回复 @' + xEscape(c.replyToAuthor) + '</div>'
      : ''
    return '<div class="x-comment-item" data-comment-id="' + xEscape(c.id || '') + '">' +
      '<div class="x-comment-avatar">' + avatarHTML + '</div>' +
      '<div class="x-comment-body">' +
        '<div class="x-comment-header">' +
          '<span class="x-comment-author">' + xEscape(c.author || '') + '</span>' +
          '<span class="x-comment-time">' + xEscape(c.time || '') + '</span>' +
        '</div>' +
        replyHTML +
        '<div class="x-comment-content">' + formatXContent(c.content || '') + '</div>' +
        '<div class="x-comment-footer">' +
          '<div class="x-comment-likes"><i class="fa-regular fa-heart"></i> ' + formatXNumber(c.likes || 0) + '</div>' +
          '<button type="button" class="x-comment-reply-btn" data-author="' + xEscape(c.author || '') + '">回复</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  }).join('')
}

async function postXUserComment(user, post, text, replyToAuthor) {
  text = String(text || '').trim()
  if (!text) return null
  var profile = await getXProfile(user)
  var comment = {
    id: genXPostId(),
    authorId: user.id,
    author: getXProfileName(user, profile),
    avatar: (profile && profile.avatar) || user.avatar || '',
    content: text,
    replyToAuthor: replyToAuthor || '',
    likes: 0,
    time: formatXRelativeTime(Date.now())
  }
  var comments = await getXPostComments(user, post.id)
  comments.push(comment)
  await saveXPostComments(user, post.id, comments)

  var feed = await getXFeed(user)
  var stored = feed.find(function(p) { return String(p.id) === String(post.id) })
  if (stored) {
    stored.comments = comments.length
    await saveXFeed(user, feed)
    post.comments = comments.length
  }
  return comments
}

function bindXDetailComposer(page, user, post) {
  var input = page.querySelector('#x-detail-comment-input')
  var sendBtn = page.querySelector('#x-detail-comment-send')
  var replyBar = page.querySelector('#x-detail-reply-target')
  var replyNameEl = page.querySelector('#x-detail-reply-target-name')
  var replyCancel = page.querySelector('#x-detail-reply-cancel')
  var commentsList = page.querySelector('#x-detail-comments')
  var replyTarget = ''

  function setReplyTarget(author) {
    replyTarget = author || ''
    if (replyBar) replyBar.hidden = !replyTarget
    if (replyNameEl) replyNameEl.textContent = replyTarget
    if (input) input.focus()
  }

  // 用事件委托绑在列表容器上，评论列表重新渲染后无需重新绑定每个"回复"按钮
  if (commentsList) {
    commentsList.addEventListener('click', function(e) {
      var btn = e.target.closest('.x-comment-reply-btn')
      if (btn) setReplyTarget(btn.dataset.author || '')
    })
  }
  if (replyCancel) replyCancel.addEventListener('click', function() { setReplyTarget('') })

  async function send() {
    var text = input ? input.value.trim() : ''
    if (!text) return
    if (sendBtn) sendBtn.disabled = true
    try {
      var comments = await postXUserComment(user, post, text, replyTarget)
      if (!comments) return
      if (input) input.value = ''
      setReplyTarget('')
      var listEl = page.querySelector('#x-detail-comments')
      if (listEl) listEl.innerHTML = renderXCommentsHTML(comments)
      var scrollEl = page.querySelector('.x-detail-scroll')
      if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight
    } catch (e) {
      console.error('发布 X 评论失败：', e)
      window.toast && window.toast('发布失败：' + (e.message || e))
    } finally {
      if (sendBtn) sendBtn.disabled = false
    }
  }

  if (sendBtn) sendBtn.addEventListener('click', send)
  if (input) {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        send()
      }
    })
  }
}

async function generateXPostComments(user, post) {
  if (!window.callAI) {
    window.toast && window.toast('请先配置 API')
    return
  }
  var existing = await getXPostComments(user, post.id)
  if (existing.length) {
    showXCommentRegenerateChoice(user, post, existing)
    return
  }
  await showXCommentCharSheet(user, post, { mode: 'replace' })
}

function showXCommentRegenerateChoice(user, post, existing) {
  var modal = openXCenterModal(
    '<div class="sheet-title">生成评论</div>' +
    '<div class="x-generate-sub">这条帖子已经有评论。你可以继续生成新评论，或删除当前评论后重新生成。</div>' +
    '<div class="sheet-actions">' +
      '<button class="btn-ghost btn-pill" id="x-comment-choice-cancel" type="button">取消</button>' +
      '<button class="btn-pill" id="x-comment-choice-continue" type="button">继续生成</button>' +
      '<button class="btn-pill btn-full" id="x-comment-choice-replace" type="button">删除并重新生成</button>' +
    '</div>'
  )
  modal.sheet.querySelector('#x-comment-choice-cancel').addEventListener('click', modal.close)
  modal.sheet.querySelector('#x-comment-choice-continue').addEventListener('click', function() {
    modal.close()
    showXCommentCharSheet(user, post, { mode: 'append', existing: existing })
  })
  modal.sheet.querySelector('#x-comment-choice-replace').addEventListener('click', function() {
    modal.close()
    showXCommentCharSheet(user, post, { mode: 'replace' })
  })
}

async function showXCommentCharSheet(user, post, options) {
  options = options || {}
  var chars = await getXAvailableCharacters()

  var charsHTML = chars.length
    ? chars.map(function(c) {
        return '<label class="x-gen-char-row"><input type="checkbox" class="x-comment-char-cb" value="' + c.id + '" checked><span>' + xEscape(c.nick || c.name) + '</span></label>'
      }).join('')
    : '<div class="x-gen-empty-chars">暂无已建角色，将全部生成路人评论</div>'

  var modal = openXCenterModal(
    '<div class="sheet-title">生成评论</div>' +
    '<div class="x-generate-sub">选择本次参与评论的角色（不选则全部为路人评论；取消勾选某个角色可以让他这次不出现）</div>' +
    '<div class="x-gen-char-list">' + charsHTML + '</div>' +
    '<div class="x-gen-count-row"><span>生成数量</span><input type="number" id="x-comment-gen-count" value="25" min="1" max="50" class="input-field x-gen-count-input"></div>' +
    '<div class="sheet-actions">' +
      '<button class="btn-ghost btn-pill" id="x-comment-char-cancel" type="button">取消</button>' +
      '<button class="btn-pill btn-full" id="x-comment-char-confirm" type="button">生成</button>' +
    '</div>'
  )
  modal.sheet.querySelector('#x-comment-char-cancel').addEventListener('click', modal.close)
  modal.sheet.querySelector('#x-comment-char-confirm').addEventListener('click', function() {
    var selectedIds = [].slice.call(modal.sheet.querySelectorAll('.x-comment-char-cb:checked')).map(function(cb) { return parseInt(cb.value, 10) })
    var countInput = modal.sheet.querySelector('#x-comment-gen-count')
    var count = parseInt(countInput && countInput.value, 10) || 25
    modal.close()
    runXCommentGeneration(user, post, Object.assign({}, options, { charIds: selectedIds, count: count }))
  })
}

function buildXCommentImagePromptParts(post) {
  var src = String((post && post.image) || '').trim()
  var isVisual = /^data:image\//i.test(src) || /^https?:\/\//i.test(src)
  if (!src || !isVisual) return { imageContentParts: [], imageNote: '' }
  return {
    imageContentParts: [{ type: 'image_url', image_url: { url: src } }],
    imageNote: '【帖子配图】已附带这张帖子的实际配图，请结合图片里真实的内容生成评论（具体夸/吐槽图片里的东西、角度、氛围等），不要脱离图片内容瞎编。\n\n'
  }
}

async function runXCommentGeneration(user, post, options) {
  options = options || {}
  var loading = showXGeneratingModal('生成评论')
  try {
    loading.setStatus('正在整理上下文...')
    var allChars = await getXAvailableCharacters()
    // 注意：charIds 可能是空数组（用户手动取消了全部勾选，代表"这次全用路人"），
    // 不能用 .length 真值判断，要用 !== undefined 区分"没传"和"传了空数组"
    var hasSelection = options.charIds !== undefined
    var chars = hasSelection
      ? allChars.filter(function(c) { return options.charIds.indexOf(c.id) !== -1 })
      : allChars
    var excludedChars = hasSelection
      ? allChars.filter(function(c) { return options.charIds.indexOf(c.id) === -1 })
      : []
    loading.setStatus('正在读取最近的微信聊天记录...')
    var chatContextMap = await buildXRecentChatContextMap(user, chars)
    var postAuthorId = post.authorId
    var charBlock = chars.length
      ? chars.map(function(c) {
          var base = '- ' + (c.nick || c.name) + '（id:' + c.id + '）：' + String(c.description || '无设定').slice(0, 200)
          if (postAuthorId != null && String(postAuthorId) !== String(c.id)) {
            base += '\n  与发帖人关系：' + getXRelationText(c, postAuthorId)
          }
          var chat = chatContextMap[c.id]
          if (chat) base += '\n  ' + chat.replace(/\n/g, '\n  ')
          base += getXCharacterLanguageNote(c)
          return base
        }).join('\n')
      : '（暂无已建角色，全部使用路人评论）'
    var excludedBlock = excludedChars.length
      ? excludedChars.map(function(c) { return (c.nick || c.name) }).join('、')
      : ''
    var existingBlock = (options.existing && options.existing.length)
      ? options.existing.map(function(c) { return '- ' + c.author + '：' + c.content }).join('\n')
      : '（暂无）'
    var imageParts = buildXCommentImagePromptParts(post)

    var count = Number(options.count) > 0 ? Number(options.count) : 25
    var prompt =
      '你正在为一条 X（Twitter）帖子生成评论区互动。\n\n' +
      '【帖子作者】' + post.name + '\n' +
      '【帖子内容】' + post.content + '\n\n' +
      imageParts.imageNote +
      '【可参与评论的角色】\n' + charBlock + '\n\n' +
      '【已有评论】\n' + existingBlock + '\n\n' +
      '【任务】生成 ' + count + ' 条新评论。角色评论要贴合其人设、以及和帖子作者的关系。如果角色有"近期微信聊天记录"且与当前帖子情境相关，可以自然呼应（比如提到刚聊过的事、吐槽对方"这时候还有空发帖"之类），但不要生硬复述或每条都提。如果某个角色标注了【语言要求】，该角色的每一条评论都必须严格使用指定语言撰写，优先级高于其他所有规则，不能违反。可以有评论互相回复。禁止生成用户本人（' + getXUserName(user) + '）的评论。\n\n' +
      (excludedBlock
        ? '【本次排除的角色，严禁出现】' + excludedBlock + ' 这次不参与评论。不允许任何评论以他们的名字、昵称或账号署名出现，不管是作为"可参与角色"还是路人马甲都不行——哪怕你认识这个名字（比如是知名虚构人物/公众人物），本次生成也绝对不能用这个名字当评论作者。路人评论的作者名必须是普通网名，不能撞上上面这些被排除的名字。\n\n'
        : '') +
      '【出场频率控制】大多数评论应该来自路人网友，不是每个已建角色都要出现——每个已建角色在这批新评论里最多出现1-2条，不要让同一个角色反复刷屏；已建角色之间也不需要每次都互相回复或搭话，多数情况下各自独立发言就好，只有关系明确很近的角色才偶尔互动一下。\n' +
      '【关系权重】角色是否出现、评论语气亲密与否，要参考上面标注的"与发帖人关系"：跟发帖人关系明确（恋人/好友/家人等）的角色，出现和互动更合理、语气可以更亲近或更敢开玩笑；关系写着"(未设定)"的角色，跟发帖人不熟，更适合演成路人吃瓜心态（评价、调侃、旁观），不要写得像多年好友一样自来熟。\n' +
      '【去重要求】这' + count + '条评论之间禁止内容、句式、开头相近或重复，每条要有自己的角度和语气，不要出现两条意思相似的评论。\n\n' +
      '【评论区氛围——重要】先判断帖子本身的调性，再照着对应的例子模仿语感（不是照抄例句，是学它的说话方式、直白程度、用词），禁止写得比这些例子更委婉、更含蓄：\n\n' +
      '如果帖子偏性感/晒身材/网黄福利向，直接照下面这个尺度写，每一条例子都已经用了具体的粗俗词汇，不是打比方、不是留白，新写的评论也必须一样具体，不能只剩下感叹词：\n' +
      '- 这逼看着就湿了吧，谁顶得住\n' +
      '- 这身材不日一次说不过去，真的会犯法\n' +
      '- 看得我直接硬了，说出来是有点丢人但是真的\n' +
      '- 这也太骚了吧，想操死\n' +
      '- 求求了别发了，看一次硬一次\n' +
      '- 这腰这臀，真想按着从后面来一发\n' +
      '- 这样穿是故意让人想操的吧\n' +
      '- 想把脸埋进去，谁懂\n' +
      '- 这奶子晃得，隔着屏幕都想上手\n' +
      '- 私信已经打好草稿了，就想问问这身材睡一次多少钱\n' +
      '- 这也太会勾人了，看完直接想抄家伙\n' +
      '- 谁家的骚货，这么会穿\n' +
      '- fuck me this should be illegal, I\'m so hard rn\n' +
      '- not me trying to slide into her dms after seeing this\n' +
      '- who let her post this, I can\'t stop staring\n' +
      '- this is doing unholy things to me rn\n' +
      '❌ 禁止只写空洞感叹词而不带具体内容，比如单独一句"救命""绝了""这也太直接了吧""顶不住了"——这类没有信息量、没有具体描写的话不算数，必须像上面例子一样带出具体的身体部位/动作/欲望描写。性器官和粗俗动词（骚、逼、操、草、湿、硬、上、干等）能用就直接用，不要用"那个""下面""某个部位"这种代称绕开。\n\n' +
      '如果帖子只是日常碎碎念、没有性感元素，改用朋友间正常的调侃/夸赞/吐槽语气，别硬凑黄色内容：\n' +
      '- 你这也太懒了吧哈哈哈\n' +
      '- 蹲一个后续\n' +
      '- 好家伙这是要闹哪样\n' +
      '- 笑不活了\n\n' +
      '硬性红线（不可突破，优先级高于以上所有要求）：任何评论都不能把爸爸/妈妈/老公/老婆/儿子/女儿/兄弟姐妹/老师/学生等家庭或师生身份和性内容搭配在一起，哪怕只是玩梗也不行。\n' +
      '也别让评论区变成清一色彩虹屁——混入几条纯玩梗、吃醋、催更、求私信，偶尔一条不买账的吐槽或黑评。\n\n' +
      '严格只返回 JSON 数组，不要 Markdown 代码块，不要任何解释文字。每条格式：\n' +
      '{"authorId": 数字或null, "author": "评论者昵称", "content": "评论内容", "replyToAuthor": "被回复人昵称，顶级评论留空"}'

    loading.setStatus('AI 正在生成评论...')
    var userMessage = imageParts.imageContentParts.length
      ? { role: 'user', content: [{ type: 'text', text: prompt }].concat(imageParts.imageContentParts) }
      : { role: 'user', content: prompt }
    var raw = await window.callAI([userMessage], { temperature: 0.9 })
    var items = parseXJsonArray(raw)
    if (!items.length) throw new Error('生成结果为空，请重试')

    var newComments = items.map(function(item) {
      var authorId = (item.authorId != null && item.authorId !== "" && !isNaN(Number(item.authorId))) ? Number(item.authorId) : null
      var authorChar = authorId != null ? chars.find(function(c) { return c.id === authorId }) : null
      return {
        id: genXPostId(),
        authorId: authorChar ? authorChar.id : null,
        author: authorChar ? (authorChar.nick || authorChar.name) : (item.author || 'X用户'),
        avatar: authorChar ? (authorChar.avatar || '') : '',
        content: decodeXHtmlEntities(item.content || ''),
        replyToAuthor: item.replyToAuthor || '',
        likes: Math.floor(Math.random() * 60),
        time: formatXRelativeTime(Date.now())
      }
    })

    var comments = options.mode === 'append' ? (options.existing || []).concat(newComments) : newComments
    await saveXPostComments(user, post.id, comments)

    var feed = await getXFeed(user)
    var stored = feed.find(function(p) { return String(p.id) === String(post.id) })
    if (stored) {
      stored.comments = comments.length
      await saveXFeed(user, feed)
      post.comments = comments.length
    }

    loading.close()
    window.toast && window.toast(options.mode === 'append' ? '评论已继续生成' : '评论已生成')
    await showXPostDetail(user, post)
  } catch (e) {
    loading.close()
    console.error('生成 X 评论失败：', e)
    window.toast && window.toast('生成失败：' + (e.message || e))
  }
}
