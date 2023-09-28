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

import { Vector3 } from '@dimforge/rapier3d-compat'
import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { AuthService, AuthState } from '@etherealengine/client-core/src/user/services/AuthService'
import { Engine } from '@etherealengine/engine/src/ecs/classes/Engine'
import { UUIDComponent } from '@etherealengine/engine/src/scene/components/UUIDComponent'
import {
  addActionReceptor,
  getMutableState,
  getState,
  removeActionReceptor,
  useHookstate
} from '@etherealengine/hyperflux'
import IconButton from '@etherealengine/ui/src/primitives/mui/IconButton'

import { LockReset, MusicNote, MusicOff } from '@mui/icons-material'
import ClickAwayListener from '@mui/material/ClickAwayListener'

import { useShelfStyles } from '../../../components/Shelves/useShelfStyles'
import { AvatarService } from '../../services/AvatarService'
// import { AuthService } from '../../services/AuthService';
// import { AvatarService } from '../../services/AvatarService';
import styles from './index.module.scss'
import { PopupMenuServiceReceptor, PopupMenuServices, PopupMenuState } from './PopupMenuService'

const audioInstance = new Audio(
  ''
)

// Function to decode JWT token and retrieve information
const decodeJWTToken = (token) => {
  const base64Url = token.split('.')[1]
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const jsonPayload = decodeURIComponent(
    window
      .atob(base64)
      .split('')
      .map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      })
      .join('')
  )

  return JSON.parse(jsonPayload)
}

export const UserMenu = () => {
  const authState = useHookstate(getMutableState(AuthState))
  const location = useLocation()
  const popupMenuState = useHookstate(getMutableState(PopupMenuState))
  const popupMenu = getState(PopupMenuState)
  const Panel = popupMenu.openMenu ? popupMenu.menus[popupMenu.openMenu] : null
  const hotbarItems = popupMenu.hotbar
  const [audioState, setAudioState] = React.useState(false)
  const [myUserEntity, setMyUserEntity]: any = useState()
  const [audiIcon, setAudioIcon] = React.useState(<MusicNote />)
  const ringtoneStart = () => {
    if (audioState) {
      audioInstance.pause()
      setAudioState(false)
      setAudioIcon(<MusicNote />)
    } else {
      audioInstance.currentTime = 0
      audioInstance.loop = true
      audioInstance.play()
      setAudioState(true)
      setAudioIcon(<MusicOff />)
    }
  }

  useEffect(() => {
    addActionReceptor(PopupMenuServiceReceptor)
    return () => {
      removeActionReceptor(PopupMenuServiceReceptor)
    }
  }, [])

  const { bottomShelfStyle } = useShelfStyles()

  // Codes to fetch personal information from Datalocker
  useEffect(() => {
    if (localStorage.getItem('pdl_access_token')) {
      const userId = Engine.instance.userId
      AuthService.updateUsername(userId, 'PDL User')
    }
  }, [])

  const updateAvatar = async (user) => {
    return await AvatarService.updateUserAvatarId(Engine.instance.userId, user?.id)
  }

  // Function to check if the entity exists and fetch the entity
  let tempEntity
  const getMyEntityId = () => {
    tempEntity = UUIDComponent.entitiesByUUID[Engine.instance.userId]

    if (!tempEntity) {
      setTimeout(() => {
        getMyEntityId()
      }, 1000)
    } else {
      setMyUserEntity(tempEntity)
    }
  }

  useEffect(() => {
    getMyEntityId()
  }, [])
  const allAvatarList = async () => {
    return await AvatarService.newFetchAvatarList3()
  }

  // Function to generate random number between 0 and 1
  const getRandomNumber: any = () => Math.floor(Math.random() * (2 - 0) + 0)
  let itemClick
  useEffect(() => {
    let selectedAvatar
    if (myUserEntity) {
      const fetchAllAvatar = allAvatarList
      fetchAllAvatar().then((data) => {
        if (localStorage.getItem('keycloakUser')) {
          if (localStorage.getItem('selectavatar')) {
            selectedAvatar = data?.find((avatar) => avatar.name === localStorage.getItem('selectavatar'))
          } else {
            selectedAvatar = data?.find((avatar) => avatar.name === localStorage.getItem('avatarname'))
          }
        } else {
          selectedAvatar = data[getRandomNumber()]
          authState.user.isGuest.set(false)
        }

        const updateUser = updateAvatar(selectedAvatar)

        updateUser.then(() => {
          itemClick = document.querySelector('.custom-0')
          if (!localStorage.getItem('keycloakUser')) {
            itemClick?.click()
          } else {
            authState.user.isGuest.set(false)
          }
        })
      })
    }
  }, [myUserEntity])

  return (
    <div>
      <ClickAwayListener onClickAway={() => PopupMenuServices.showPopupMenu()} mouseEvent="onMouseDown">
        <>
          <section
            className={`${styles.hotbarContainer} ${bottomShelfStyle} ${
              popupMenuState.openMenu.value ? styles.fadeOutBottom : ''
            }`}
          >
            <div className={styles.buttonsContainer}>
              {Object.keys(hotbarItems).map((id, index) => {
                const IconNode = hotbarItems[id]
                if (!IconNode) return null
                if (index !== 1 && index !== 3) {
                  return (
                    <IconButton
                      key={index}
                      type="solid"
                      icon={<IconNode />}
                      sizePx={50}
                      onClick={() => PopupMenuServices.showPopupMenu(id)}
                      sx={{
                        cursor: 'pointer',
                        background: 'var(--iconButtonBackground)'
                      }}
                    />
                  )
                }
              })}
              <IconButton
                key="13"
                type="solid"
                icon={<LockReset />}
                sizePx={50}
                onClick={() => {
                  const world = Engine.instance.physicsWorld
                  world.bodies.map.data.find((arr) => {
                    if (arr.isDynamic()) {
                      arr.setLinvel(new Vector3(0, 0, 0))
                      arr.setAngvel(new Vector3(0, 0, 0))
                      arr.setTranslation(new Vector3(7, 0.8, -12.8))
                    }
                  })
                }}
              />
              {/*               <IconButton
                key={5}
                type="solid"
                icon={audiIcon}
                sizePx={50}
                onClick={ringtoneStart}
                sx={{
                  cursor: 'pointer',
                  background: 'var(--iconButtonBackground)'
                }}
              /> */}
            </div>
          </section>
          {Panel && <Panel {...popupMenu.params} />}
        </>
      </ClickAwayListener>
    </div>
  )
}
