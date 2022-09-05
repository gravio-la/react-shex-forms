import {ComponentMeta, ComponentStory} from '@storybook/react'
import * as React from 'react'

import { ShexForm } from '../src'


const argTypes = {
  debugEnabled: { description: 'verbose debug output', control: 'radio' , defaultValue: true},
}

export default {
  component: ShexForm,
  parameters: {
    layout: 'fullscreen'
  },
  argTypes
} as ComponentMeta<typeof ShexForm>



const baseURI = 'http://a.example/schema1'

const shexSchema = `
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX vc: <http://www.w3.org/2006/vcard/ns#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX : <http://janeirodigital.com/layout#>
PREFIX solid: <http://www.w3.org/ns/solid/terms#>
BASE <${baseURI}>

<#UserProfile> {
  $<#UserProfile-TC-webid-1>
      solid:webid IRI ;

      (   foaf:name xsd:string MinLength 2
        | foaf:givenName xsd:string ;
          foaf:familyName xsd:string
        | foaf:alias @<#UserProfile> ;
      )? ;

      vc:telephone IRI /^tel:\\+?[0-9.-]/ ? ;

      vc:hasAddress @<#vcard_street-address> * ;

  $<#UserProfile-TC-organization-name-1>
      vc:organization-name xsd:string ? ;

      vc:someInt xsd:integer ;
      vc:otherInt xsd:integer OR xsd:string ;
      vc:registered xsd:boolean ;
}

<#vcard_street-address> CLOSED {
  $<#vcard_street-address-type>
    a [vc:Home vc:Postal] ? ;

  $<#vcard_street-address-street-address-1>
      vc:street-address xsd:string ? ;

      (   vc:locality xsd:string ? ;
        | vc:region xsd:string ?
      ) ;

  $<#vcard_street-address-country-name-1>
      vc:country-name @<#vcard_country-name> ? ;
      vc:postal-code xsd:string ?
}

<#vcard_country-name> [
  "Afghanistan"
  "Belgium"
  "CR"
  "France"
  "日本"
  "United Kingdom"
  "United States"
  "Zimbabwe"
]

<#IssueShape> {
  foaf:reproducedBy @<#EmployeeShape>?
}

ABSTRACT <#PersonShape> {
  foaf:name xsd:string ;
  foaf:mbox IRI
}

<#UserShape> EXTENDS <#PersonShape> {
  foaf:representative @<#EmployeeShape>
}

ABSTRACT <#RepShape> {
  foaf:phone IRI+
}

<#EmployeeShape>
  EXTENDS <#PersonShape> & <#RepShape> {
}
`
const Template: ComponentStory<typeof ShexForm> = ( args ) =>
  <ShexForm {...args} shexDocument={shexSchema} baseURI={baseURI} startShapeURI='http://a.example/schema1#UserProfile' rootURI={'http://example.org/me'}/>

export const BasicForm = Template.bind( {} )
