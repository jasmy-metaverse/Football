/*
CPAL-1.0 License

The contents of this file are subject to the Common Public Attribution License
Version 1.0. (the "License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at
https://github.com/EtherealEngine/etherealengine/blob/dev/LICENSE.
The License is based on the Mozilla Public License Version 1.1, but Sections 14
and 15 have been added to cover use of software over a computer network and 
provide for limited attribution for the Original Developer. In addition, 
Exhibit A has been modified to be consistent with Exhibit B.

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the
specific language governing rights and limitations under the License.

The Original Code is Ethereal Engine.

The Original Developer is the Initial Developer. The Initial Developer of the
Original Code is the Ethereal Engine team.

All portions of the code written by the Ethereal Engine team are Copyright © 2021-2023 
Ethereal Engine. All Rights Reserved.
*/

// spawnPose is temporary - just so portals work for now - will be removed in favor of instanceserver-instanceserver communication
import { Quaternion, Vector3 } from 'three'

import { EntityUUID } from '@etherealengine/common/src/interfaces/EntityUUID'
import { PeerID } from '@etherealengine/common/src/interfaces/PeerID'
import { getSearchParamFromURL } from '@etherealengine/common/src/utils/getSearchParamFromURL'
import { dispatchAction, getMutableState, useHookstate } from '@etherealengine/hyperflux'
import { Action } from '@etherealengine/hyperflux/functions/ActionFunctions'

import { AvatarNetworkAction } from '../../avatar/state/AvatarNetworkState'
import { Engine } from '../../ecs/classes/Engine'
import { EngineActions } from '../../ecs/classes/EngineState'
import { NetworkTopics } from '../classes/Network'
import { WorldState } from '../interfaces/WorldState'
import { AuthState } from '@etherealengine/client-core/src/user/services/AuthService'

export type JoinWorldRequestData = {
  inviteCode?: string
}

export type JoinWorldProps = {
  peerIndex: number
  routerRtpCapabilities: any
  cachedActions: Required<Action>[]
}

export type SpawnInWorldProps = {
  avatarSpawnPose: { position: Vector3; rotation: Quaternion }
  avatarID: string
  name: string
}

// All avatars glb and png files location object
// const avatarList = [
//   {
//     url: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//CyberbotBlack.glb`,
//     thumbnail: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//CyberbotBlack.png`
//   },
//   {
//     url: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//CyberbotBlue.glb`,
//     thumbnail: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//CyberbotBlue.png`
//   },
//   {
//     url: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//CyberbotCyan.glb`,
//     thumbnail: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//CyberbotCyan.png`
//   },
//   {
//     url: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//CyberbotGold.glb`,
//     thumbnail: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//CyberbotGold.png`
//   },
//   {
//     url: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//CyberbotGreen.glb`,
//     thumbnail: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//CyberbotGreen.png`
//   },
//   {
//     url: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//CyberbotPink.glb`,
//     thumbnail: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//CyberbotPink.png`
//   },
//   {
//     url: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//CyberbotRed.glb`,
//     thumbnail: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//CyberbotRed.png`
//   },
//   {
//     url: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//CyberbotSilver.glb`,
//     thumbnail: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//CyberbotSilver.png`
//   },
//   {
//     url: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//CyberbotYellow.glb`,
//     thumbnail: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//CyberbotYellow.png`
//   }
// ]

// New provided male and female avatar location
const avatarList = [
  {
    url: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//male.glb`,
    thumbnail: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//male.png`
  },
  {
    url: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//female.glb`,
    thumbnail: `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//female.png`
  }
]

// const handleAvatarSelection = (avatarDetail) => {
//   // Restrict Wintos JR loading based on PDL login and env variable setup
//   if (process.env.VITE_WINTOSJR_AVATAR_VISIBILITY == 'false') {
//     if (localStorage.getItem('keycloakUser') == 'true') {
//       // PDL login
//       if (localStorage.getItem('currentAvatarURL') && localStorage.getItem('currentAvatarThumbnail')) {
//         // Not selected using confirm button
//         avatarDetail.avatarURL = localStorage.getItem('currentAvatarURL') || avatarList[0].url
//         avatarDetail.thumbnailURL = localStorage.getItem('currentAvatarThumbnail') || avatarList[0].thumbnail
//       } else {
//         // After PDL login
//         avatarDetail.avatarURL = `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//WintosJR1.glb`
//         avatarDetail.thumbnailURL = `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//WintosJR1.png`
//       }
//     } else {
//       // PDL logout
//       if (avatarDetail.avatarURL === `${process.env.VITE_FILE_SERVER}/static-resources/avatar/public//WintosJR1.glb`) {
//         // If Wintos JR found without PDL login
//         const randomLength = Math.floor(Math.random() * avatarList.length)

//         // Select random male or female avatar
//         avatarDetail.avatarURL = avatarList[randomLength].url
//         avatarDetail.thumbnailURL = avatarList[randomLength].thumbnail

//         // For preview showing
//         if (randomLength == 0) {
//           localStorage.setItem('Selected', 'male')
//         } else if (randomLength == 1) {
//           localStorage.setItem('Selected', 'female')
//         }
//       } else {
//         // For preview showing
//         if (avatarDetail.avatarURL == avatarList[0].url) {
//           localStorage.setItem('Selected', 'male')
//         } else {
//           localStorage.setItem('Selected', 'female')
//         }
//       }
//     }
//   }
// }

// const authState = useHookstate(getMutableState(AuthState))
export const spawnLocalAvatarInWorld = (props: SpawnInWorldProps) => {
  const { avatarSpawnPose, avatarID, name } = props

  // const user = authState.user
  // console.log("Iffat - ",user)

  // Restrict Wintos JR loading based on PDL login and env variable setup
  // handleAvatarSelection(avatarDetail)

  console.log('SPAWN IN WORLD', avatarSpawnPose, avatarID, name)
  const worldState = getMutableState(WorldState)
  const entityUUID = Engine.instance.userId as string as EntityUUID
  worldState.userNames[Engine.instance.userId].set(name)
  dispatchAction(AvatarNetworkAction.spawn({ ...avatarSpawnPose, entityUUID }))
  dispatchAction(AvatarNetworkAction.setAvatarID({ avatarID, entityUUID }))
}

export const receiveJoinWorld = (props: JoinWorldProps) => {
  if (!props) return
  const { cachedActions } = props
  console.log('RECEIVED JOIN WORLD RESPONSE', cachedActions)

  for (const action of cachedActions) Engine.instance.store.actions.incoming.push({ ...action, $fromCache: true })

  const spectateUserId = getSearchParamFromURL('spectate')
  if (spectateUserId) {
    dispatchAction(EngineActions.spectateUser({ user: spectateUserId }))
  }

  dispatchAction(EngineActions.joinedWorld({}))

  Engine.instance.store.actions.outgoing[NetworkTopics.world].queue.push(
    ...Engine.instance.store.actions.outgoing[NetworkTopics.world].history
  )
}
