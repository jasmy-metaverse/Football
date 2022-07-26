import { World } from '@xrengine/engine/src/ecs/classes/World'
import { addComponent, getComponent } from '@xrengine/engine/src/ecs/functions/ComponentFunctions'
import { PersistTagComponent } from '@xrengine/engine/src/scene/components/PersistTagComponent'
import { XRUIComponent } from '@xrengine/engine/src/xrui/components/XRUIComponent'
import { ObjectFitFunctions } from '@xrengine/engine/src/xrui/functions/ObjectFitFunctions'
import { WidgetName, Widgets } from '@xrengine/engine/src/xrui/Widgets'

import { createMediaSessionMenuView } from './ui/MediaSessionMenuView'

export function createMediaSessionMenuWidget(world: World) {
  const ui = createMediaSessionMenuView()

  addComponent(ui.entity, PersistTagComponent, true)

  const xrui = getComponent(ui.entity, XRUIComponent)
  ObjectFitFunctions.setUIVisible(xrui.container, false)

  Widgets.registerWidget(world, ui.entity, {
    ui,
    label: WidgetName.MEDIA_SESSION,
    system: () => {}
  })
}
