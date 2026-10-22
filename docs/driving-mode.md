# Driving mode

Start Drive uses a zoomed 2D MapLibre view with adaptive zoom and the vehicle anchored 75% down the unobstructed map area. The camera bearing follows device heading when available, otherwise the nearest road segment direction. The vehicle arrow points up while following. Roads and route geometry rotate together, with readable map labels. An unknown heading preserves the last camera bearing and displays a location dot. Dragging pauses follow; Resume Follow or recenter restores it. Map clicks cannot replace the destination during a drive.

OSRM requests include `steps=true`. The backend validates and normalizes step coordinates, distance, duration, road name, maneuver type/modifier, bearing and roundabout exit into the optional `steps` field. Older route responses remain usable as line previews. Deploy backend before frontend for maneuver instructions.

The location controller requests high-accuracy updates during a drive, restores ordinary location options afterwards, and pauses while the document is hidden. Guidance needs a fresh fix no older than 15 seconds and accuracy of 50 metres or better. Start Drive remains available with a less accurate fresh fix so it can request precise GPS.

`features/navigation/guidance.ts` projects location onto route segments and derives remaining distance, approximate time and the upcoming maneuver. It is pure and tested independently. Explorer owns drive state; MapView owns the Leaflet planning camera; DriveMap owns the MapLibre driving camera and overlays; the backend owns external maneuver validation. Nothing stores the journey or coordinates persistently.

Alternatives considered: replace Leaflet with a MapLibre camera for pitch/heading-up, or retain Leaflet for the requested close 2D view. The Leaflet adapter cannot rotate its overlays with the native camera, so heading-up driving uses a separate MapLibre renderer. Planning stays in Leaflet. Ending a drive remounts the planning map and fits the route preview. Driving remains flat, without pitch.

Current limitations: visual instructions only, no voice, traffic, background navigation or automatic rerouting. Off-route locations over 50 metres from the line get a manual recalculation action. Time remaining is proportional to route progress, not a live ETA. Nearest-segment matching can be ambiguous on overlapping roads, loops and interchanges. Arrival requires both the final 25 metres of route progress and being within 30 metres of its snapped endpoint. Device GPS and real-road behavior still need physical testing.

## Maneuver banner

The banner shows a single road-style maneuver arrow, distance and street instruction. The lane strip was removed at the user's request. Optional lane metadata remains in the API for compatibility but is not displayed.

## Speed and travelled route

The driving panel displays device-reported GPS speed in km/h, rounded from metres per second. Zero is shown only for an actual zero reading. Missing, non-finite, negative, stale or low-accuracy readings show a dash. No distance-over-time speed estimate is substituted.

Driving route geometry starts at the projected GPS position on the current road segment. Travelled points are removed from both the blue line and its outline; at the final endpoint the geometry is empty. A stale, inaccurate or off-route fix leaves the last trusted remaining geometry intact. Style changes restore that remaining geometry. Ending the drive restores the full planning preview. Matching on overlapping roads retains the nearest-segment limitations described above.

## Camera tuning

Initial MapLibre zoom targets are 16.5 below 50 km/h or when speed is unknown, 16 from 50 km/h, and 15.5 from 80 km/h. Within 120 metres of the next maneuver, use zoom 17. These are initial tuning choices, not a validated universal standard. Plus/minus overrides the automatic zoom until recenter. Header and sheet measurements determine the usable map area; resize recomputes the anchor. On desktop the camera also clears the left panels. Heading-up and the flat 2D view are retained.
