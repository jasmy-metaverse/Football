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

// import * as chapiWalletPolyfill from 'credential-handler-polyfill'
import CryptoJS from 'crypto-js'
import { SnackbarProvider } from 'notistack'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { AdminCoilSettingService } from '@etherealengine/client-core/src/admin/services/Setting/CoilSettingService'
import { initGA, logPageView } from '@etherealengine/client-core/src/common/analytics'
import { defaultAction } from '@etherealengine/client-core/src/common/components/NotificationActions'
import {
  NotificationAction,
  NotificationActions
} from '@etherealengine/client-core/src/common/services/NotificationService'
import { ProjectService, ProjectState } from '@etherealengine/client-core/src/common/services/ProjectService'
import Debug from '@etherealengine/client-core/src/components/Debug'
import InviteToast from '@etherealengine/client-core/src/components/InviteToast'
import { theme } from '@etherealengine/client-core/src/theme'
import { AuthService, AuthState } from '@etherealengine/client-core/src/user/services/AuthService'
import { AvatarService } from '@etherealengine/client-core/src/user/services/AvatarService'
import GlobalStyle from '@etherealengine/client-core/src/util/GlobalStyle'
import { AudioEffectPlayer } from '@etherealengine/engine/src/audio/systems/MediaSystem'
import { matches } from '@etherealengine/engine/src/common/functions/MatchesUtils'
import { Engine } from '@etherealengine/engine/src/ecs/classes/Engine'
import { addActionReceptor, getMutableState, removeActionReceptor, useHookstate } from '@etherealengine/hyperflux'
import { loadWebappInjection } from '@etherealengine/projects/loadWebappInjection'

import { StyledEngineProvider, Theme, ThemeProvider } from '@mui/material/styles'

import RouterComp from '../route/public'
import { ThemeContextProvider } from '../themes/themeContext'

declare module '@mui/styles/defaultTheme' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface DefaultTheme extends Theme {}
}

/** @deprecated see https://github.com/EtherealEngine/etherealengine/issues/6485 */

const AppPage = ({ route }: { route: string }) => {
  const notistackRef = useRef<SnackbarProvider>()
  const authState = useHookstate(getMutableState(AuthState))
  const selfUser = authState.user
  const [projectComponents, setProjectComponents] = useState<Array<any>>([])
  const [fetchedProjectComponents, setFetchedProjectComponents] = useState(false)
  const projectState = useHookstate(getMutableState(ProjectState))
  const redirectUrl = process.env.VITE_PORTAL_LOCATION
  const initApp = useCallback(() => {
    initGA()
    logPageView()
  }, [])
  const privateKey = 'abc'
  const { search } = useLocation()
  const handleCodeVerify = () => {
    const query = window.location.search.substring(1)
    const params = new URLSearchParams(query)
    const code = params.get('code')
    const username = params.get('username') || ''
    const avatarname = params.get('avatarname') || ''
    if (
      avatarname === 'male' ||
      avatarname === 'female' ||
    ) {
      const signer = CryptoJS.HmacSHA256(username, privateKey).toString()
      if (signer === code) {
        AuthService.updateUsername(Engine.instance.userId, username)
        authState.user.isGuest.set(false)
        localStorage.setItem('keycloakUser', 'true')
        localStorage.setItem('usercode', 'true')
        localStorage.setItem('username', username)
        localStorage.setItem('userCode', signer)
        localStorage.setItem('avatarname', avatarname)
      } else {
        window.location.href = redirectUrl
      }
    } else {
      window.location.href = redirectUrl
    }
  }

  useEffect(() => {
    const UrlVerifyParams = search?.includes('?code' && 'username' && 'avatarname')
    if (UrlVerifyParams) {
      handleCodeVerify()
    } else {
      window.location.href = redirectUrl
    }
  }, [Engine.instance.userId])

  useEffect(() => {
    const receptor = (action): any => {
      // @ts-ignore
      matches(action).when(NotificationAction.notify.matches, (action) => {
        AudioEffectPlayer.instance.play(AudioEffectPlayer.SOUNDS.alert, 0.5)
        notistackRef.current?.enqueueSnackbar(action.message, {
          variant: action.options.variant,
          action: NotificationActions[action.options.actionType ?? 'default']
        })
      })
    }
    addActionReceptor(receptor)

    return () => {
      removeActionReceptor(receptor)
    }
  }, [])

  useEffect(initApp, [])

  // useEffect(() => {
  //   chapiWalletPolyfill
  //     .loadOnce()
  //     .then(() => console.log('CHAPI wallet polyfill loaded.'))
  //     .catch((e) => console.error('Error loading polyfill:', e))
  // }, [])

  useEffect(() => {
    if (selfUser?.id.value && projectState.updateNeeded.value) {
      ProjectService.fetchProjects()
      if (!fetchedProjectComponents) {
        setFetchedProjectComponents(true)
        Engine.instance.api
          .service('projects')
          .find()
          .then((projects) => {
            loadWebappInjection(projects).then((result) => {
              setProjectComponents(result)
            })
          })
      }
    }
  }, [selfUser, projectState.updateNeeded.value])

  useEffect(() => {
    Engine.instance.userId = selfUser.id.value
  }, [selfUser.id])

  useEffect(() => {
    authState.isLoggedIn.value && AdminCoilSettingService.fetchCoil()
  }, [authState.isLoggedIn])

  let socket
  let socketInterval
  const [socketConnectionState, setSocketConnectionState] = React.useState(false)

  useEffect(() => {
    if (!socketConnectionState) {
      try {
        socketConnection()
      } catch {
        console.log('Socket connection failed')
      }
    }

    return () => clearInterval(socketInterval)
  }, [socketConnectionState])

  const socketConnection = () => {
    socket = new WebSocket(`wss://${window.location.host}`)

    socket.onopen = function () {
      console.log('socket open')
      socket.send('Ping Open')
    }

    socket.onmessage = function (event) {
      console.log(`[message] Data received from server: ${event.data}`)
      console.log('socket onmessage', event.data)
      socket.send('Ping from dancing')
    }

    socket.onclose = function (event) {
      setSocketConnectionState(false)
      clearInterval(socketInterval)
      if (event.wasClean) {
        socketConnection()
        console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`)
      } else {
        // e.g. server process killed or network down
        // event.code is usually 1006 in this case
        console.log('[close] Connection died')
      }
    }

    socket.onerror = function (error) {
      setSocketConnectionState(false)
      clearInterval(socketInterval)
      console.log(`[error]`, error)
      setTimeout(() => {
        socketConnection()
      }, 2000)
    }
  }

  return (
    <>
      <ThemeContextProvider>
        <StyledEngineProvider injectFirst>
          <ThemeProvider theme={theme}>
            <SnackbarProvider
              ref={notistackRef as any}
              maxSnack={7}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              action={defaultAction}
            >
              <GlobalStyle />
              <div style={{ pointerEvents: 'auto' }}>
                <InviteToast />
                <Debug />
              </div>
              <RouterComp route={route} />
              {projectComponents.map((Component, i) => (
                <Component key={i} />
              ))}
            </SnackbarProvider>
          </ThemeProvider>
        </StyledEngineProvider>
      </ThemeContextProvider>
    </>
  )
}

export default AppPage
