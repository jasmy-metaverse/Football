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

import { RigidBody, Vector3 as VT } from '@dimforge/rapier3d-compat'
import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Mesh } from 'three'

import { EditorControlFunctions } from '@etherealengine/editor/src/functions/EditorControlFunctions'
import { AssetLoader } from '@etherealengine/engine/src/assets/classes/AssetLoader'
import { AudioEffectPlayer } from '@etherealengine/engine/src/audio/systems/MediaSystem'
import { changeAvatarAnimationState } from '@etherealengine/engine/src/avatar/animation/AvatarAnimationGraph'
import { AvatarAnimations, AvatarStates } from '@etherealengine/engine/src/avatar/animation/Util'
import { AnimationManager } from '@etherealengine/engine/src/avatar/AnimationManager'
import { AvatarComponent } from '@etherealengine/engine/src/avatar/components/AvatarComponent'
import { Engine } from '@etherealengine/engine/src/ecs/classes/Engine'
import { Entity } from '@etherealengine/engine/src/ecs/classes/Entity'
import { getComponent } from '@etherealengine/engine/src/ecs/functions/ComponentFunctions'
import { TransformComponent } from '@etherealengine/engine/src/transform/components/TransformComponent'
import Button from '@etherealengine/ui/src/primitives/mui/Button'
import Icon from '@etherealengine/ui/src/primitives/mui/Icon'

import ClickAwayListener from '@mui/material/ClickAwayListener'

import { PopupMenuServices } from '../PopupMenuService'
import styles from './EmoteMenu.module.scss'

const MAX_EMOTE_PER_PAGE = 6
const MIN_EMOTE_PER_PAGE = 1
const getEmotePerPage = () => (window.innerWidth > 768 ? MAX_EMOTE_PER_PAGE : MIN_EMOTE_PER_PAGE)

const CLAP_DURATION = 1200 as const
const CRY_DURATION = 6300 as const
const KICK_DURATION = 600 as const
const KISS_DURATION = 4599 as const
const WAVE_DURATION = 5133 as const
const LAUGH_DURATION = 9800 as const
const DEFEAT_DURATION = 6766 as const

export const useEmoteMenuHooks = () => {
  const [page, setPage] = useState(0)
  const [imgPerPage, setImgPerPage] = useState(getEmotePerPage())

  let [menuRadius, setMenuRadius] = useState(window.innerWidth > 360 ? 182 : 150)

  let menuPadding = window.innerWidth > 360 ? 25 : 20
  let menuThickness = menuRadius > 170 ? 70 : 60
  let menuItemWidth = menuThickness - menuPadding
  let menuItemRadius = menuItemWidth / 2
  let effectiveRadius = menuRadius - menuItemRadius - menuPadding / 2

  const findAvatarAnimationDuration = (avatarAnimation: string): number => {
    let animationDuration

    if (avatarAnimation === AvatarStates.CLAP) {
      animationDuration = CLAP_DURATION
    } else if (avatarAnimation === AvatarStates.CRY) {
      animationDuration = CRY_DURATION
    } else if (avatarAnimation === AvatarStates.KICK) {
      animationDuration = KICK_DURATION
    } else if (avatarAnimation === AvatarStates.KISS) {
      animationDuration = KISS_DURATION
    } else if (avatarAnimation === AvatarStates.WAVE) {
      animationDuration = WAVE_DURATION
    } else if (avatarAnimation === AvatarStates.LAUGH) {
      animationDuration = LAUGH_DURATION
    } else if (avatarAnimation === AvatarStates.DEFEAT) {
      animationDuration = DEFEAT_DURATION
    }

    return animationDuration
  }

  const reRunDynamicAnimation = (animationDuration: number) => {
    setTimeout(() => {
      if (localStorage.getItem('dynamic') === AvatarStates.DANCE1) {
        runAnimation(AvatarStates.DANCE1)
        localStorage.removeItem('dynamic')
      } else if (localStorage.getItem('dynamic') === AvatarStates.DANCE2) {
        runAnimation(AvatarStates.DANCE2)
        localStorage.removeItem('dynamic')
      } else if (localStorage.getItem('dynamic') === AvatarStates.DANCE3) {
        runAnimation(AvatarStates.DANCE3)
        localStorage.removeItem('dynamic')
      } else if (localStorage.getItem('dynamic') === AvatarStates.DANCE4) {
        runAnimation(AvatarStates.DANCE4)
        localStorage.removeItem('dynamic')
      }
    }, animationDuration)
  }

  // The function for ball movement while kicking
  const kickFunction = (delay: number = 0) => {
    setTimeout(() => {
      const world = Engine.instance.physicsWorld
      const ball = world.bodies.map.data.find((arr) => arr.isDynamic()) as RigidBody
      const bT = getComponent(ball.userData.entity as Entity, TransformComponent).position
      const entity = Engine.instance.localClientEntity
      const aT = getComponent(entity, TransformComponent).position
      const forcePower = process.env.VITE_FORCE_POWER
      const dx = bT.x - aT.x
      const dz = bT.z - aT.z
      const distance = Math.sqrt(dx * dx + dz * dz)
      if (distance < parseFloat(process.env.VITE_KICK_DISTANCE)) {
        const forceY = (1.7 - distance) * (forcePower / 3)
        const absSum = Math.abs(dx) + Math.abs(dz)
        const forceX = (dx / absSum) * forcePower
        const forceZ = (dz / absSum) * forcePower
        const force = new VT(forceX, forceY, forceZ)
        ball.applyImpulse(force, true)
      }
    }, delay)
  }

  //Facial expression code starts
  const changeTexture = async (texture: string) => {
    const entity = Engine.instance.localClientEntity
    const avatar = getComponent(entity, AvatarComponent)
    const hier = avatar.model?.children[0].children[0].children[0].children.find((child) => child.name === 'head')
    const id = hier?.uuid
    const mesh = hier as Mesh
    const preMap = mesh.material.map
    const prop = await AssetLoader.loadAsync(texture)
    EditorControlFunctions.modifyMaterial([id], mesh.material.uuid, [{ ['map']: prop }])
  }
  //Facial expression code ends

  const runStaticAnimation = (avatarAnimation: string) => {
    runAnimation(avatarAnimation)
    switch (avatarAnimation) {
      case 'LAUGH':
        changeTexture(`${process.env.VITE_FILE_SERVER}/projects/default-project/assets/SGT_diffse_mewotumuru_2.png`)
        break
      case 'CRY':
        changeTexture(`${process.env.VITE_FILE_SERVER}/projects/default-project/assets/SGT_diffse_naki_2.png`)
        break
      case 'DEFEAT':
        changeTexture(`${process.env.VITE_FILE_SERVER}/projects/default-project/assets/SGT_diffse_kandou_2.png`)
        break
      case 'WAVE':
        changeTexture(`${process.env.VITE_FILE_SERVER}/projects/default-project/assets/SGT_diffse_kirakira_2.png`)
        break
      case 'CLAP':
        changeTexture(`${process.env.VITE_FILE_SERVER}/projects/default-project/assets/SGT_diffse_yorokobi_2.png`)
        break
    }
    const animationDuration: number = findAvatarAnimationDuration(avatarAnimation)
    reRunDynamicAnimation(animationDuration)
  }

  const kickItem = [
    {
      body: <img src="/static/Kick_white 1.svg" alt="Kick" />, // TODO: Icon need to be changed
      containerProps: {
        onClick: () => {
          runStaticAnimation(AvatarStates.KICK)
          kickFunction()
        }
      }
    }
  ]
  const [items, setItems] = useState<any>(kickItem)

  // two sets of emotion animation for two different world ends here

  const calculateMenuRadius = () => {
    setImgPerPage(getEmotePerPage())
    setMenuRadius(window.innerWidth > 360 ? 182 : 150)
    calculateOtherValues()
  }

  useEffect(() => {
    window.addEventListener('resize', calculateMenuRadius)
    calculateOtherValues()
  }, [])

  const closeMenu = (e) => {
    e.preventDefault()
    PopupMenuServices.showPopupMenu()
  }

  const calculateOtherValues = (): void => {
    menuThickness = menuRadius > 170 ? 70 : 60
    menuItemWidth = menuThickness - menuPadding
    menuItemRadius = menuItemWidth / 2
    effectiveRadius = menuRadius - menuItemRadius - menuPadding / 2
  }

  const runAnimation = (stateName: string) => {
    const entity = Engine.instance.localClientEntity
    changeAvatarAnimationState(entity, stateName)
    // close Menu after playing animation
    PopupMenuServices.showPopupMenu()
  }

  const renderEmoteList = () => {
    const itemList = [] as JSX.Element[]
    const startIndex = page * imgPerPage
    const endIndex = Math.min(startIndex + imgPerPage, items.length)
    let angle = 360 / imgPerPage
    let index = 0
    let itemAngle = 0
    let x = 0
    let y = 0

    for (let i = startIndex; i < endIndex; i++, index++) {
      const emoticon = items[i]
      itemAngle = angle * index + 270
      x = effectiveRadius * Math.cos((itemAngle * Math.PI) / 280)
      y = effectiveRadius * Math.sin((itemAngle * Math.PI) / 280)

      itemList.push(
        <div key={i}>
          <Button
            className={styles.menuItem}
            {...emoticon.containerProps}
            onPointerUp={() => AudioEffectPlayer.instance.play(AudioEffectPlayer.SOUNDS.ui)}
            onPointerEnter={() => AudioEffectPlayer.instance.play(AudioEffectPlayer.SOUNDS.ui)}
            style={{
              width: menuItemWidth,
              height: menuItemWidth,
              transform: `translate(${x}px , ${y}px)`
            }}
          >
            {emoticon.body}
          </Button>
        </div>
      )
    }

    return itemList
  }

  const loadNextEmotes = (e) => {
    e.preventDefault()
    if ((page + 1) * imgPerPage >= items.length) return
    setPage(page + 1)
  }
  const loadPreviousEmotes = (e) => {
    e.preventDefault()
    if (page === 0) return
    setPage(page - 1)
  }

  return {
    closeMenu,
    menuRadius,
    menuThickness,
    loadPreviousEmotes,
    menuItemRadius,
    renderEmoteList,
    page,
    imgPerPage,
    items,
    loadNextEmotes
  }
}

const EmoteMenu = (): JSX.Element => {
  const {
    closeMenu,
    menuRadius,
    menuThickness,
    loadPreviousEmotes,
    menuItemRadius,
    renderEmoteList,
    page,
    imgPerPage,
    items,
    loadNextEmotes
  } = useEmoteMenuHooks()

  return (
    <section className={styles.emoteMenu}>
      <ClickAwayListener onClickAway={closeMenu} mouseEvent="onMouseDown">
        <div
          className={styles.itemContainer}
          style={{
            width: menuRadius * 2,
            height: menuRadius * 2,
            borderWidth: menuThickness
          }}
        >
          <div className={styles.itemContainerPrev}>
            <button
              type="button"
              className={`${styles.iconBlock} ${page === 0 ? styles.disabled : ''}`}
              onClick={loadPreviousEmotes}
              onPointerUp={() => AudioEffectPlayer.instance.play(AudioEffectPlayer.SOUNDS.ui)}
              onPointerEnter={() => AudioEffectPlayer.instance.play(AudioEffectPlayer.SOUNDS.ui)}
            >
              <Icon type="NavigateBefore" />
            </button>
          </div>
          <div
            className={styles.menuItemBlock}
            style={{
              width: menuItemRadius,
              height: menuItemRadius
            }}
          >
            {renderEmoteList()}
          </div>
          <div className={styles.itemContainerNext}>
            <button
              type="button"
              className={`${styles.iconBlock} ${(page + 1) * imgPerPage >= items.length ? styles.disabled : ''}`}
              onClick={loadNextEmotes}
              onPointerUp={() => AudioEffectPlayer.instance.play(AudioEffectPlayer.SOUNDS.ui)}
              onPointerEnter={() => AudioEffectPlayer.instance.play(AudioEffectPlayer.SOUNDS.ui)}
            >
              <Icon type="NavigateNext" />
            </button>
          </div>
        </div>
      </ClickAwayListener>
    </section>
  )
}

export default EmoteMenu
