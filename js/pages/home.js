"use strict"

const initReactFriends = () => { // TODO: Move elsewhere
	InjectJS.inject(() => {
		const { reactHook, contentScript, settings } = BTRoblox
	
		reactHook.hijackConstructor( // FriendsList
			(type, props) => "friendsList" in props, 
			(target, thisArg, args) => {
				if(settings.home.friendsSecondRow) {
					const friendsList = args[0].friendsList
					
					reactHook.hijackUseState( // visibleFriendsList
						(value, index) => value === friendsList,
						(value, initial) => (value && friendsList) ? friendsList.slice(0, value.length * 2) : value
					)
				}
				
				const result = target.apply(thisArg, args)
				
				try { result.props.className = `${result.props.className ?? ""} btr-friends-list` }
				catch(ex) { console.error(ex) }
				
				if(settings.home.friendsSecondRow) {
					try { result.props.className = `${result.props.className ?? ""} btr-friends-secondRow` }
					catch(ex) { console.error(ex) }
				}
				
				return result
			}
		)
		
		if(settings.home.friendsShowUsername) {
			const friendsState = reactHook.createGlobalState({})
			
			contentScript.listen("updateFriends", friends => {
				friendsState.set(friends)
			})
			
			reactHook.hijackConstructor( // FriendTileContent
				(type, props) => props.displayName && props.userProfileUrl,
				(target, thisArg, args) => {
					const result = target.apply(thisArg, args)
					
					try {
						const userId = args[0].id
						
						const labels = reactHook.queryElement(result, x => x.props.className?.includes("friends-carousel-tile-labels"))
						if(labels && Array.isArray(labels.props.children)) {
							const friends = reactHook.useGlobalState(friendsState)
							const friend = friends[userId]
							
							if(friend) {
								labels.props.children.splice(1, 0, 
									reactHook.createElement("div", {
										className: "friends-carousel-tile-sublabel btr-friends-carousel-username-label",
										children: reactHook.createElement("span", {
											className: "btr-friends-carousel-username",
											children: `@${friend.name}`
										})
									})
								)
							}
						}
					} catch(ex) {
						console.error(ex)
					}
					
					return result
				}
			)
		}
		
		if(settings.home.friendPresenceLinks) {
			reactHook.hijackConstructor( // FriendTileDropdown
				(type, props) => props.friend && props.gameUrl,
				(target, thisArg, args) => {
					const result = target.apply(thisArg, args)
					
					try {
						const card = result.props.children?.[0]
						
						if(card?.props.className?.includes("in-game-friend-card")) {
							result.props.children[0] = reactHook.createElement("a", {
								href: args[0].gameUrl,
								style: { display: "contents" },
								onClick: event => event.preventDefault(),
								children: card
							})
						}
					} catch(ex) {
						console.error(ex)
					}
					
					return result
				}
			)
		}
	})
	
	if(SETTINGS.get("home.friendsShowUsername")) {
		InjectJS.send("updateFriends", btrFriends.getFriends())
		btrFriends.loadFriends(friends => InjectJS.send("updateFriends", friend))
	}
}

pageInit.home = () => {
	initReactFriends()
	
	// legacy angular friends stuff (just in case react stuff gets disabled?)
	
	if(SETTINGS.get("home.friendsShowUsername")) {
		document.$watch(">body", body => body.classList.add("btr-home-showUsername", "btr-home-friends"))
		
		angularHook.modifyTemplate("people", card => {
			const container = card.$find(".friend-parent-container")
			
			if(container) {
				document.body.classList.add("btr-home-showUsername")
				container.after(html`<div class="text-overflow xsmall text-label btr-people-username" title="@{{friend.name}}">@{{friend.name}}</div>`)
			}
		})
	}
	
	if(SETTINGS.get("home.friendsSecondRow")) {
		document.$watch(">body", body => body.classList.add("btr-home-secondRow", "btr-home-friends"))

		InjectJS.inject(() => {
			const { angularHook } = window.BTRoblox
			
			angularHook.hijackModule("peopleList", {
				layoutService(handler, args) {
					const result = handler.apply(this, args)
					result.maxNumberOfFriendsDisplayed *= 2
					return result
				}
			})
		})
	}
	
	if(SETTINGS.get("home.friendPresenceLinks")) {
		angularHook.modifyTemplate("people-info-card", template => {
			for(const elem of template.$findAll(`[ng-click^="goToGameDetails"]`)) {
				const anchor = document.createElement("a")
				anchor.href = `{{friend.presence.placeUrl}}`
				anchor.append(...elem.childNodes)
				for(const attr of elem.attributes) {
					anchor.setAttribute(attr.name, attr.value)
				}
				elem.replaceWith(anchor)
			}
		})
	}
}