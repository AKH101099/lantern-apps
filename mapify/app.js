/**
* Renders markers to a map-based canvas and counts the number of markers
* Also offers a search-box to find relevant markers
*/
(function () {
    var self, ctx, user, map
    let Interface = {}
    let Component = {
        mounted () {
            if (self) return
            self = this
            Interface.bindAll()
        },
        callback: (data) => {
            if (ctx) return
            ctx = data.app.context
            user = data.app.context.user
            map = data.app.context.map
            map.render(ctx.cloud)
        }
    }
    let Action = {}



    // ------------------------------------------------------------------------

    /**
    * Preserves center map location with browser-based storage
    */
    const cacheCenterLocation  = (timeout) => {
        let center = map.getCenter()
        // only save to database if user has paused on this map for a few seconds
        setTimeout(() => {
            if (center === "ew" || map.getCenterAsString() === localStorage.getItem('lx-ctr')) {
                // don't bother saving default north american view
                return
            }
            let newCenter = map.getCenter()
            if (center === newCenter) {
                //console.log(`(mapify) caching center geohash: ${newCenter}`);
                localStorage.setItem('lx-ctr', newCenter)
            }
        }, timeout || 5000)
    }

    /**
    * Use saved per-user location to center map
    */
    const setViewFromCenterLocationCache = () => {
        let ctr = localStorage.getItem('lx-ctr')
        try {
            let parts = ctr.split('/')
            map.setView([parts[0], parts[1]], parts[2])
            // console.log(`${this.logPrefix} restoring view = ${parts}`)
        } catch (e) {
            // will fall back to default view if no markers available
            map.setDefaultView()
        }
    }


    Interface.showMarker = (marker) => {

        if (marker.layer && marker.layer._map) {
            // already added to map
            //console.log("(mapify) skip show marker, already on map...", marker.id, marker.geohash);
            return
        }

        //console.log("(mapify) show marker", marker.id, marker.geohash);

        marker.tags.forEach((tag) => {
            if (self.icons.hasOwnProperty(tag)) {
                marker.icon = self.icons[tag]
            }
        })

        if (marker.icon) {
            map.addToMap(marker)
        }

        marker.on('change', (key) => {
            console.log(key)
            // if this is a ping, open details on map
            if (key == 'ping') {
                map.panToPoint(marker.latlng)
                self.$root.$emit('marker-focus', marker)
            }
        })
    }

    Interface.hideMarker = (marker) => {
        //console.log('(mapify) hide existing marker', marker.id)
        map.removeFromMap(marker)
    }

    Interface.defineIconClasses = () => {
        // set up custom icons for menu
        for (var idx in self.categories) {
            let menu = self.categories[idx]
            menu.forEach((item) => {
                if (self.icons.hasOwnProperty(item.tag)) {
                    // only show sub-menu icons
                    if (!self.categories.hasOwnProperty(item.tag)) {
                        item.icon_class = 'fa fa-' + self.icons[item.tag]
                        item.tag_class = 'tag-icon ' + item.tag
                        if (idx != 'main') {
                            item.tag_class += ' ' + idx
                        }
                    }
                }
            })
        }
    }

    Interface.bindAll = () => {
        Interface.setupControls()
        Interface.displayMarkers()
        ctx.feed.on('reset', Interface.displayMarkers)
        Interface.defineIconClasses()
        // try to save center location after the map moves
        map.view.on('moveend', (e) => {
            cacheCenterLocation()
        })
        // other marker and map-related apps
        ctx.openOneApp('composer')
        ctx.openOneApp('xray')
        ctx.openOneApp('status')


        ctx.feed.on('item-watch', (e) => {
            Interface.showMarker(e.item)
            if (self.markers.length == 1) {
                map.panToPoint(e.item.latlng)
            }
        })

        ctx.feed.on('item-unwatch', (e) => {
            if (e.item && e.item.layer) {
                Interface.hideMarker(e.item)
            }
        })

    }


    Interface.displayMarkers = () => {
        let feed = ctx.feed

        self.markers = []
        self.markers = feed.itemsList

        feed.itemsList.forEach((id) => {
            Interface.showMarker(feed.items[id])
        })
        map.zoomMinimum(8)
        map.fitMapToAllMarkers(feed.activeItems)
    }

    /**
    * Display zoom and locate controls over the map interface
    */
    Interface.setupControls = () => {
        // add zoom in & out control
        let zoom = L.control.zoom()
        zoom.setPosition('bottomright')
        zoom.addTo(map.view)

        // create custom zoom icons
        let zoom_in = document.getElementsByClassName('leaflet-control-zoom-in')[0]
        let elem = document.createElement('span')
        elem.className = 'fa fa-plus'
        zoom_in.innerHTML = ''
        zoom_in.appendChild(elem)
        let zoom_out = document.getElementsByClassName('leaflet-control-zoom-out')[0]
        let elem2 = document.createElement('span')
        elem2.className = 'fa fa-minus'
        zoom_out.innerHTML = ''
        zoom_out.appendChild(elem2)

    }

    Interface.promptForNewMarker = () => {
        self.$root.$emit('marker-draft')
    }

    // ------------------------------------------------------------------------

    Component.methods = {
        searchMap: () => {
            self.show_search = !self.show_search
        },
        fitMap: () => {
            if (self.snapback) {
                let parts = self.snapback.split('/')
                let zoomLevel = Number(parts[2])
                map.view.setView([parts[0], parts[1]], (zoomLevel > 1 ? zoomLevel : 8))
                console.log('(mapify) snapback to ' + self.snapback)
                self.snapback = null
            }
            else {
                self.snapback = map.getCenterAsString()
                map.fitMapToAllMarkers(ctx.feed.activeItems)
            }

        },
        chooseFromMenu: (item) => {
            // open up item details
            self.$root.$emit('marker-focus', item)
            self.show_search = false
        },
        closeMenu: () => {
            self.show_search = false
        },
        getCategory: (item) => {
            return item.getCategory(self.categories)
        },
        getMarkerClass: (item) => {
            return 'tag-icon ' + item.tags.join(' ')
        },
        getMarkerIconClass: (item) => {
            let cls = 'fa '
            item.tags.forEach((tag) => {
                if (self.icons.hasOwnProperty(tag)) {
                    cls += ' fa-' + self.icons[tag]
                }
            })
            return cls
        },
        searchFilter: (type) => {
            self.filter = type || self.filter
        }, 
        getSearchButtonClass: (type) => {
            if (type.label == self.filter.label) {
                return 'button is-selected is-info'
            }
            else {
                return 'button'
            }
        },
        promptForNewMarker:  Interface.promptForNewMarker
    }

    Component.data = {
        markers: null,
        show_search: false,
        snapback: false,
        types: [
            {
                'label': 'Resource',
                'match': ['rsc']
            },
            {
                'label': 'Task',
                'match': ['tsk']
            },
            {
                'label': 'Report',
                'match': [ 'sit'], 
            },
            {
                'label': 'Site',
                'match': ['ven']
            }
        ],
        latlng: null
    }

    Component.data.filter = Component.data.types[0]

    Component.computed = {}

    Component.computed.filtered_markers = () => {
        let filter = self.filter || self.types[0]
        let list = []
        if (self.markers) {
            self.markers.forEach(key => {
                let item = ctx.feed.items[key]
                if (item) {
                    let intersection = filter.match.filter(x => item.tags.includes(x));
                    if (intersection.length) {
                        list.push(item)
                    }
                }
            })
        }
        return list
    }

    return Component
}())
