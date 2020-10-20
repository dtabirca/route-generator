// list areas or segments
Vue.component('list-component', {
	template:  `<div v-if="show=='areas'">
					<table class="list">
						<item-area v-for="item in items" :item="item"></item-area>
					</table>
				</div>
				<div v-else-if="show=='segments'">
					<a href="#" v-on:click="list.loadAreas()">^ UP</a>
					<filter-component :points="points"></filter-component>
					<div id="map" class="leaflet-map"></div>
					<table class="list">
						<item-segment v-for="item in items" :item="item"></item-segment>
					</table>
				</div>`,   
	props: {
		items: Array,
		show: String,
		points: Array
	},
	updated: function(){
		if (this.show == 'segments'){
			if (this.map == undefined){
				this.map = new L.Map('map', {
					zoom: 13,
					center: L.latLng(45.633832, 25.592953),
					fullscreenControl: false,
					resizerControl: false,
					layersControl: false,
					zoomControl: false,
					searchControl: false,
					locateControl:false,
					pegmanControl:false,
					minimapControl:false,
					loadingControl:false,
					attributionControl: false
				});
			} else{

				// clear routes
			    for(i in this.map._layers) {
			        if(this.map._layers[i]._path != undefined) {
			            try {
			                this.map.removeLayer(this.map._layers[i]);
			            } catch{

			            }
					}
				}
				// add routes
				var route;
				var point;
				var polyL;
 				list.items.forEach((o,i)=>{
 					route = [];
 					o.path.forEach((p,j)=>{
 						point = list.points.filter(d=>d.id==Number(p))[0];
 						route.push(L.latLng(point.lat,point.lng));
 					});
 					polyL = new L.Polyline(route, {
 					    color: '#' + Math.floor(Math.random()*16777215).toString(16),
					    weight: 3,
					    opacity: 1,
						smoothFactor: 1
					});
					polyL.addTo(this.map);
 				});
				
				//console.log(list.items);
			}
		}
	}
});
// filter
var filter = Vue.component('filter-component', {
	template:  `<div class="filter">
					<span>Routes on {{list.title}}:</span><br>
					<!--Unique segments: <input v-on:change="filter()" type="checkbox" value="1" checked v-model="unique"><br-->
					Closed loop: <input v-on:change="filter()" type="checkbox" value="1" checked v-model="closed"><br>
					Starting point: <select v-on:change="filter()" id="id_start_point" v-model="start_point">
						<option v-if="point.start==1" v-for="(point, index) in points" v-bind:value="point.id" >
							{{point.name}}
						</option>
					</select><br>
					Distance: 
					<input v-on:change="filter()" type="range" min="1" max="15" value="{{distance}}" class="slider" id="id_distance" v-model="distance">
				     -> {{parseInt(distance)-1}}-{{parseInt(distance)+1}}km<br>
					<!--Max ascent:
					<input v-on:change="filter()" type="range" min="0" max="2000" class="slider" id="id_ascent" v-model="ascent" step="50"> -> {{ascent}}m<br>
					<a href="#" v-on:click="reorder()">Reverse</a><br-->
				</div>`,
	props: {
		points: Array
	},
	data: function(){
		return {
			distance: 10,
			ascent: 400,
			start_point: null,
			unique: 1,
			closed: 1, 
		}
	},
	updated: function(){
		this.start_point = this.start_point != null ? this.start_point : this.points[0].id;
		//this.filter();
	},
	methods: {
		reorder(){
			list.items.reverse();
		},
		findMatchingSegments(r){

			currpoint = r.path[r.path.length-1];
			prevpoint = r.path[r.path.length-2] || null;
			var wantedAsc  = parseInt(this.ascent);
			var wantedDist = parseInt(this.distance*1000);

			var matching = [];
			var longest  = list.segments[0];
			list.segments.forEach((o,i) => {
				if (o.poi2 == currpoint){ // reverse segment
					o.poi2 = o.poi1; 
					o.poi1 = currpoint;
					var asc = o.asc;
					o.asc  = o.desc;
					o.desc = asc;
				}
				if (o.poi1 == currpoint // segments starting from last point
					&& Number(o.poi2)!=prevpoint// don't go back
					//&& parseInt(r.dist) + parseInt(o.dist) >= wantedDist - 1000 && o.poi2 == r.path[0]

					//&& ((!this.unique && Number(o.poi2)!=prevpoint) // might be already there 
					//	|| (this.unique && !r.path.includes(Number(o.poi2))) // shouldn't be already there
					//	|| (this.closed && parseInt(r.dist) + parseInt(o.dist) >= wantedDist - 1000 && o.poi2 == r.path[0]) // last segment should close the loop
					//)
					) {
					//&& !matching.includes(o)){ // don't return on the same segments
					//if (
						//parseInt(r.dist) + parseInt(o.dist) <= wantedDist + 1000
					//	 o.dist > longest.dist){
//					 	longest = o;
					//}
					//console.log(o.poi1 + '-' + o.poi2);
					matching.push(o);
				}
			});
			
			return matching;
		},
		filter(){

			// find segments from start_point
			var possibleRoutes = [];
			var matchingSegments = [];
			var startPoint = this.start_point;
			var currAsc    = 0;
			var currDist   = 0;
			var wantedAsc  = parseInt(this.ascent);
			var wantedDist = parseInt(this.distance*1000);
			var routeInit  = {'path': [Number(this.start_point)], 'dist': 0, 'asc': 0, 'desc': 0};
			this.findMatchingSegments(routeInit).forEach((o,i) => {
			
				if (parseInt(o.asc) <= wantedAsc
					&& parseInt(o.dist) <= wantedDist + 1000){
					possibleRoutes.push({
						'path': [Number(this.start_point),Number(o.poi2)],
						'dist': parseInt(o.dist),
						'asc': parseInt(o.asc),
						'desc': parseInt(o.desc),
						'done':1,
					});
				}
			});

			exitLoop = false;
			var finalRoutes = [];
			var baseForNewRoute;
			var currentRoute;
			wloop:
			while(!exitLoop){
				exitLoop = true;
	 			rloop:
	 			for (var r=0; r<possibleRoutes.length; r++) {
	 				if (possibleRoutes[r].done < 10){// limit number of segments
						baseForNewRoute = _.cloneDeep(possibleRoutes[r]);
	 					exitLoop = false;
	 					possibleRoutes[r].done += 1;
	 					matchingSegments = this.findMatchingSegments(possibleRoutes[r]);
		 				for (var i=0; i<matchingSegments.length; i++) {
		 					if (
		 							(this.closed == 0 && parseInt(matchingSegments[i].dist)+possibleRoutes[r].dist <= wantedDist + 1000) ||
									(this.closed == 1 && parseInt(matchingSegments[i].dist)+possibleRoutes[r].dist <= (wantedDist + 1000)/2)
		 						) { 
			
		 						if (i===0){//update original
									possibleRoutes[r].path.push(Number(matchingSegments[i].poi2));
									possibleRoutes[r].dist += parseInt(matchingSegments[i].dist);
									possibleRoutes[r].asc  += parseInt(matchingSegments[i].asc);
									possibleRoutes[r].desc += parseInt(matchingSegments[i].desc);
									currentRoute = possibleRoutes[r];
								} else{// create new route
									var done;
									if (parseInt(matchingSegments[i].dist)+baseForNewRoute.dist >= (wantedDist - 1000)){
									 	done = 10;
									} else{
									 	done = possibleRoutes[r].done;
									}
		 							possibleRoutes.push({
		 								'path': baseForNewRoute.path.concat(Number(matchingSegments[i].poi2)),
		 								'dist': baseForNewRoute.dist + parseInt(matchingSegments[i].dist),
		 								'asc': baseForNewRoute.asc + parseInt(matchingSegments[i].asc),
		 								'desc': baseForNewRoute.desc + parseInt(matchingSegments[i].desc),
		 								'done': done//
		 							});
		 							currentRoute = possibleRoutes[possibleRoutes.length-1]
								}

								if (this.closed == 1){
									if (currentRoute.dist >= (wantedDist - 1000)/2){
										// when looking for the closed routes, 
										// and reaching the half of the route,
										// the other half should be already here
										for (var ri=0; ri<possibleRoutes.length; ri++) {
											if (currentRoute !== possibleRoutes[ri]){// 
												if (possibleRoutes[ri].path[possibleRoutes[ri].path.length-1] ==
												 currentRoute.path[currentRoute.path.length-1]){
													// the last point on the current route is the last of the other route 
													if (currentRoute.dist + possibleRoutes[ri].dist >= wantedDist - 1000){
														finalRoutes.push({
															'path': currentRoute.path.slice().concat(possibleRoutes[ri].path.slice().reverse().slice(1)),
															'dist': currentRoute.dist + possibleRoutes[ri].dist,
															'asc': currentRoute.asc + possibleRoutes[ri].desc,
															'desc': currentRoute.asc + possibleRoutes[ri].asc,
															'done': currentRoute.done + possibleRoutes[ri].done
														});
														break wloop;
													}
												} 
												if (possibleRoutes[ri].path[possibleRoutes[ri].path.length-2] ==
												 currentRoute.path[currentRoute.path.length-1]){
													// the last point on the current route is the second last of the other route 
												    // find the distance on the last segment to be retracted from the total
													var lastSegmentToRetract = 0;
													for (var s=0; s<list.segments.length; s++) {
														if ( (list.segments[s].poi1 == possibleRoutes[ri].path[possibleRoutes[ri].path.length-2]
															&& list.segments[s].poi2 == possibleRoutes[ri].path[possibleRoutes[ri].path.length-1]) ||
															(list.segments[s].poi1 == possibleRoutes[ri].path[possibleRoutes[ri].path.length-1]
															&& list.segments[s].poi2 == possibleRoutes[ri].path[possibleRoutes[ri].path.length-2]) ){
															lastSegmentToRetract = list.segments[s].dist;
															break;
														} 														
													};

													if (currentRoute.dist + possibleRoutes[ri].dist - lastSegmentToRetract >= wantedDist - 1000){
														finalRoutes.push({
															'path': currentRoute.path.slice().concat(possibleRoutes[ri].path.slice().reverse().slice(2)),
															'dist': currentRoute.dist + possibleRoutes[ri].dist,
															'asc': currentRoute.asc + possibleRoutes[ri].desc,
															'desc': currentRoute.asc + possibleRoutes[ri].asc,
															'done': currentRoute.done + possibleRoutes[ri].done
														});
														break wloop;
													}
												}
											}
										}
									}
								}
							}
		 				}
		 			}
	 			}	
 			};
			//}
			
 
			// remove smaller than
			var last=[]
			if (this.closed == 0){
	 			possibleRoutes.forEach((o,i)=>{
	 				if (parseInt(o.dist) >= wantedDist-1000 
	 					){
	 					last.push(o);
	 				}
	 			});
	 		}
			list.items = this.closed == 1 ? finalRoutes : last;
		}
	}
});
// display item
Vue.component('item-area', {
	template:  `<tr v-if="item.count>0">
					<td><a href="#" v-on:click="loadSegments(item.name)">{{item.name}}</a></td>
					<td>({{item.count}} segments)</td>
				</tr>`,
	props: {
		item: Object,
		show: String
	},
	methods: {
		loadSegments(title) {

			list.show   = 'segments';
			list.items  = [];
			list.points = [];
			list.segments = [];
			list.title = title;
			Papa.parse("lib/" + this.item.id + ".segment.csv", {
				download: true,
				header: true,
				complete: function(results, file) {
					list.segments = results.data;
				}	
			});	
			Papa.parse("lib/" + this.item.id + ".point.csv", {
				download: true,
				header: true,
				complete: function(results, file) {
					list.points = results.data;
				}	
			});	
		},
	}
});
Vue.component('item-segment', {
	template:  `<tr>
					<td><a href="#" v-on:click="showSegment">{{segmentPoints()}}</a></td>
					<td>{{item.dist}}m</td>
					<td>{{item.asc}}m</td>
					<td>{{item.desc}}m</td>
				</tr>`,
	props: {
		item: Object,
	},
	methods: {
		showSegment() {
	//		console.log(this.point.filter(d=>d.id===this.item.poi1));
		},
		// join segments with point data
		segmentPoints() {
				var pois = [];
				
			if (this.item.path!=undefined){
				var path = this.item.path;
				for (var i=0; i<path.length; i++) {
					pois.push(list.points.filter(d=>d.id==Number(path[i]))[0].name);
				}
			}
			return pois.join(' -> ');
		}		
	}
});
// create vue
var list = new Vue({
	el: '#list',
	data: { 
		items: [], 
		points: [],
		segments: [],
		show: 'areas',
		title: '',
	},
	created: function(){
		this.loadAreas()
	},
	methods:{
		loadAreas: function() {
			this.items  = [];
			this.points = [];
			this.show   = 'areas';
			Papa.parse("lib/area.csv", {
				download: true,
				header: true,
				complete: function(results, file) {
					list.items = results.data;
					list.items.forEach ((o,i) => {
						Papa.parse("lib/" + list.items[i].id + ".segment.csv", {
							download: true,
							header: true,
							complete: function(results, file) {
								Vue.set(list.items[i], 'count', results.data.length);
							}	
						});
					});
				}	
			});
		},
	}
});

