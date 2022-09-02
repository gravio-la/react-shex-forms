import {ComponentMeta, ComponentStory} from '@storybook/react'
import * as React from 'react'

import { Greeting } from '../src'


const argTypes = {
  debugEnabled: { description: 'verbose debug output', control: 'radio' , defaultValue: true},
}

export default {
  component: Greeting,
  parameters: {
    layout: 'fullscreen'
  },
  argTypes
}as ComponentMeta<typeof Greeting>


const Template: ComponentStory<typeof Greeting> = ( args ) =>
  <Greeting {...args}/>

export const GreetingBasic = Template.bind( {} )
