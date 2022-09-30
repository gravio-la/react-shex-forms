import * as xsd from '@ontologies/xsd'
// @ts-ignore
import shexCore from '@shexjs/core'
import shexParser from '@shexjs/parser'
import React, {Fragment, useCallback, useEffect, useState} from 'react'
import {
  Button,
  Dropdown, DropdownProps,
  Form,
  FormDropdown,
  Icon, Input, Label, Segment,
  StrictFormDropdownProps,
  StrictFormFieldProps
} from 'semantic-ui-react'
import {
  EachOf,
  IRIREF,
  NodeConstraint,
  ObjectLiteral,
  OneOf,
  Schema,
  Shape,
  ShapeAnd,
  ShapeDecl,
  shapeExpr,
  ShapeExternal,
  ShapeNot,
  ShapeOr,
  TripleConstraint, tripleExprOrRef,
  valueSetValue
} from 'shexj'
import {v4 as uuidv4} from 'uuid'

import styles from '../styles.module.css'
import {filterUndefOrNull} from '../utils/notEmpty'

interface ShexFormProps {
  shexDocument: string | Schema,
  baseURI: string,
  startShapeURI?: string,
  rootURI: string
}

const debugVerbose = false


type ContainerProps = React.BaseHTMLAttributes<HTMLDivElement> & {
  shapeName?: string
  shape?: any
  notImplemented?: boolean
  children?: React.ReactNode
}
const Container = ( {children, shapeName, notImplemented}: ContainerProps ) => {
  return <div>
    <span
      style={{display: !debugVerbose || notImplemented ? 'none' : 'unset'}}>{shapeName || null}{notImplemented && 'not implemented'}</span>
    {children || null}
  </div>
}

const iri2Label = ( predicate: string ): string => {
  let parts = predicate.split( '#' )
  parts = parts[parts.length - 1].split( '/' )
  return parts[parts.length - 1]

}

const toOptions = ( shapes?: ShapeDecl[] ) => shapes?.map( s => ( {
  key: s.id,
  text: s.id,
  value: s.id
} )) || []

const findStartShape: ( schema: Schema, startShapeURI: string ) => ShapeDecl | undefined = ( schema: Schema, startShapeURI: string ) =>
  schema?.shapes?.find(( {id} ) => id === startShapeURI )

const getSubTreeByPath: ( doc: any, path: PathComponent[] ) => any = ( doc: any, path: PathComponent[] ) => {
  if ( path.length === 0 ) {
    return doc
  }
  const [pathEl, ...restPath] = path
  if ( typeof pathEl === 'number' ) {
    const doc_ = doc || []
    if ( !Array.isArray( doc_ )) {
      throw new Error( 'cannot descant into an object, as path component is not a number' )
    }
    return getSubTreeByPath( doc_[pathEl], restPath )
  } else {
    const {[pathEl]: doc_} = doc || {}
    return getSubTreeByPath( doc_, restPath )
  }
}
const removeFromRDFDocument: ( doc: any, path: PathComponent[], value: RemoveChangePayload ) => ( any ) = ( doc, path, value ) => {

  if ( path.length === 0 ) {
    return doc
  }
  const [pathEl, ...restPath] = path
  const descendantDoc = doc[pathEl]
  if ( typeof pathEl === 'number' ) {
    const doc_ = doc || []
    if ( !Array.isArray( doc_ )) {
      throw new Error( 'cannot descant into an object, as path component is not a number' )
    }
    if ( doc_.length > pathEl ) {
      if ( restPath.length === 0 ) {
        return doc_.filter(( element: any, i ) => i !== pathEl )
      } else {
        return doc_.map(( element, i ) => i === pathEl ? removeFromRDFDocument( element, restPath, value ) : element )
      }
    } else {
      if ( restPath.length === 0 ) {
        return doc_
      }
      if ( !descendantDoc ) {
        throw new Error( 'cannot descant into object, descendant is not defined' )
      }
      return [...doc_, removeFromRDFDocument( descendantDoc, restPath, value )]
    }
  } else {
    if ( restPath.length === 0 ) {
      const {[pathEl]: _1, ...doc_} = doc || {}
      return doc_
    } else {
      if ( !descendantDoc ) {
        throw new Error( 'cannot descant into object, descendant is not defined' )
      }
      return {...doc, [pathEl]: removeFromRDFDocument( descendantDoc, restPath, value )}
    }
  }
}

const updateRDFDocument: ( doc: any, path: PathComponent[], value: any, isIRI?: boolean ) => ( any ) = ( doc, path, value, isIRI ) => {
  //TODO this will not be very general, it assumes a certain shape of the jsonld and only supports extened jsonld
  if ( path.length === 0 ) {
    return value || ( isIRI ? '' : {} )
  }
  const [pathEl, ...restPath] = path
  if ( typeof pathEl === 'number' ) {
    const doc_ = doc || []
    if ( !Array.isArray( doc_ )) {
      throw new Error( 'cannot descant into an object, as path component is not a number' )
    }
    if ( doc_.length > pathEl ) {
      const descendantDoc = doc_[pathEl]
      return doc_.map(( element: any, i ) => {
        if ( i === pathEl ) return updateRDFDocument( descendantDoc, restPath, value, isIRI )
        return element
      } )
    } else {
      return [...doc_, updateRDFDocument( null, restPath, value, isIRI )]
    }
  } else {
    const doc_ = doc || {}
    const descendantDoc = doc_[pathEl] || []
    return {
      ...doc_,
      [pathEl]: updateRDFDocument( descendantDoc, restPath, value, isIRI )
    }
  }
}

/**
 * Main Component
 */
function ShexForm( {shexDocument, startShapeURI, baseURI, rootURI}: ShexFormProps ) {
  const [schema, setShexj] = useState<Schema | undefined>( undefined )
  const [startShape, setStartShape] = useState<ShapeDecl | undefined>( undefined )
  const [showStartShapeChooser, setShowStartShapeChooser] = useState( false )

  const [rdfDocument, setRdfDocument] = useState<{ [k: string]: any }>( {
    '@id': rootURI
  } )

  useEffect(() => {
    if ( !startShape ) {
      setShowStartShapeChooser( true )
      if ( schema?.shapes ) {
        setStartShape( schema.shapes[0] )
      }
    }
  }, [schema, startShape, setStartShape, setShowStartShapeChooser] )


  useEffect(() => {
    if ( typeof shexDocument === 'string' ) {
      const parser = shexParser.construct( baseURI )
      const parsedAS = parser.parse( shexDocument )
      const shexJ = shexCore.Util.AStoShExJ( parsedAS )
      setShexj( shexJ as Schema )
    } else {
      setShexj( shexDocument )
    }
  }, [shexDocument, baseURI] )

  useEffect(() => {
    if ( schema && startShapeURI ) {
      setShowStartShapeChooser( false )

    }
  }, [schema, startShapeURI] )


  const handleChange = useCallback<OnChangeEvent>(( context, change ) => {
    console.log( {path: context.path, change} )
    try {
      const [, ...path] = context.path
      const newDoc = updateRDFDocument( rdfDocument, path, change.value, change.isIRI )
      setRdfDocument( newDoc )
    } catch ( e ) {
      console.error( e )
    }
  }, [rdfDocument, setRdfDocument] )

  const handleRemove = useCallback<OnRemoveEvent>(
    ( context, change ) => {
      const [, ...path] = context.path
      try {
        const newDoc = removeFromRDFDocument( rdfDocument, path, change )
        setRdfDocument( newDoc )
      } catch ( e ) {
        console.error( e )
      }
    }, [rdfDocument, setRdfDocument] )


  const handleAddEmptyElement = useCallback<OnAddEmptyElementEvent>(
    ( context , isIRI ) => {
      const [, ...path] = context.path
      const newDoc = updateRDFDocument( rdfDocument, path, null, isIRI )
      setRdfDocument( newDoc )
    },
    [rdfDocument, setRdfDocument] )

  return (
    <div className={styles.container + ' container'}>
      {showStartShapeChooser && <Dropdown
        placeholder='Start Shape'
        fluid
        selection
        options={toOptions( schema?.shapes )}
        value={startShape?.id}
        onChange={( e, data ) =>
          schema && setStartShape( findStartShape( schema, data.value as string ))}
      />}
      {schema && startShape && <Form>
        <h1>{startShape?.id}</h1>
        <ShapeDeclComponent
          context={{
            schema,
            path: [rootURI],
            rdfDocument,
            baseURI,
            events: {
              onChange: handleChange,
              onRemove: handleRemove,
              onAddEmptyElement: handleAddEmptyElement
            }
          }}
          shapeDecl={startShape}/>
      </Form>}
    </div>
  )
}

type ObjectType = any
type PredicateType = string

type AtomicChangePayload = {
  value: ObjectType
  isIRI: boolean
}

type RemoveChangePayload = {
  predicate: PredicateType
  object?: ObjectType
}

type OnChangeEvent = ( context: Context, data: AtomicChangePayload ) => void
type OnRemoveEvent = ( context: Context, data: RemoveChangePayload ) => void
type OnAddEmptyElementEvent = ( context: Context, isIRI: boolean ) => void

type PathComponent = string | number

type Context = {
  schema: Schema,
  rdfDocument: object,
  path: PathComponent[],
  baseURI: string,
  events: {
    onChange: OnChangeEvent
    onRemove: OnRemoveEvent
    onAddEmptyElement: OnAddEmptyElementEvent
  }
}

type ShapeDeclProps = {
  context: Context,
  shapeDecl: ShapeDecl

}

type TripleConstraintShapeExprProps = {
  context: Context,
  tripleConstraint: TripleConstraint,
  label?: string,
  zeroOrOne?: boolean
}

type IRIChooserProps = {
  baseURI: string
  onChange: ( data: string ) => void
  value?: string
  onRemove: () => void
  allowDelete?: boolean
} & StrictFormFieldProps

type Prefixes = {
  [k:string]: string
}

const prefixes: Prefixes = {
  'tel': 'tel:',
  'schema': 'http://schema.org/',
  'foaf': 'http://xmlns.com/foaf/0.1/',
  'vc': 'http://www.w3.org/2006/vcard/ns#',
  '*': ''
}

const toValue: ( part: string, prefix: string ) => string = ( part, prefix ) => `${prefix}${part}`
const fromValue: ( iri: string, prefixes: Prefixes ) => {prefix: { key: string, substitution: string}, part: string} | undefined = ( iri, prefixes ) => {
  const prefix = Object.entries( prefixes ).find(( [, substitution] ) => substitution.length > 0 && iri.startsWith( substitution ))
  if( !prefix )
    return
  const [key, substitution] = prefix
  return {
    prefix: {key, substitution},
    part: iri.substring( substitution.length ),
    iri
  }
}
const IRIChooser = ( {baseURI, value, onChange, onRemove, allowDelete, label, error, ...props}: IRIChooserProps ) => {
  const action = allowDelete ? {
    icon: 'close',
    disabled: typeof value === 'undefined' ||  value === null,
    onClick: () => onRemove()
  } : undefined
  const { prefix, part } = value && fromValue( value, prefixes ) || {}
  console.log( {prefix, part, value} )

  const handlePrefixChange = useCallback(
    ( _e: any, data: DropdownProps ) => {
      const key= data.value as string
      const [ prevKey, prevSubstitution ] = Object.entries( prefixes ).find(( [,v] ) => v.length > 0 && value?.startsWith( v )) || []

      console.log( {key, value} )
      if( key === '*' && value ) {
        onChange( value )
      }
      const substitution = prefixes[key]
      if( !substitution )
        return
      const part = prevSubstitution ? value?.substring( prevSubstitution.length ) : ''
      onChange( `${substitution}${part}` )
    },
    [value, onChange]
  )

  return <Form.Field error={error ? {content: error, pointing: 'below'}: undefined} {...props}>
    <label>{label}</label>
    <Input
      type="text"
      label={<Dropdown
        value={prefix?.key || '*'}
        onChange={handlePrefixChange}
        options={Object.keys( prefixes ).map( key => ( {
          key, text: `${key}:`, value: key
        } ))} />}
      value={part || ''}
      action={action}
      actionPosition='left'
      onChange={e => onChange( prefix?.substitution ? toValue( e.target.value, prefix.substitution ) : e.target.value )}
    />
  </Form.Field>

}

const PrimitiveForm = ( {
  datatype,
  onChange,
  onRemove,
  value,
  allowDelete,
  ...props
}: {allowDelete?: boolean, datatype: string, onChange: ( data: any ) => void, onRemove: () => void, value: any } & StrictFormFieldProps ) => {
  const action = allowDelete ? {
    icon: 'close',
    disabled: typeof value === 'undefined' ||  value === null,
    onClick: () => onRemove()
  } : undefined

  switch ( datatype ) {
  case xsd.string.value:
    return <Form.Input
      {...props}
      action={action}
      actionPosition='left'
      type="text"
      onChange={e => onChange( {'@value': e.target.value } )}
      value={value || ''}
    />
  case xsd.integer.value:
    return <Form.Input
      {...props}
      action={action}
      actionPosition='left'
      onChange={e => onChange( { '@value': e.target.value } )}
      value={value || ''}
      type="number"
    />
  case xsd.xsdboolean.value:
    return <Form.Checkbox
      {...props}
      type="checkbox"
      indeterminate={value !== true || value !== false}
      onChange={( _e, data ) => onChange( data.checked )}
      checked={value || false}
    />
  default:
    return <Container notImplemented>other xsd</Container>
  }

}

const isObjectLiteral = ( value: valueSetValue ): value is ObjectLiteral => typeof ( value as any ).value === 'string'
const isIRIRef = ( value: valueSetValue ): value is IRIREF => typeof value === 'string'

const updatePath = ( {
  path,
  ...context
}: Context, ...pathElements: PathComponent[] ) => ( {path: [...path, ...pathElements], ...context} )

const ValuesDropdown = ( {values, ...props}: { values: valueSetValue[] } & StrictFormDropdownProps ) => {
  const options = filterUndefOrNull( values.map( v => {
    if ( isObjectLiteral( v )) return {key: v.value, value: v.value, text: v.value}
    if ( isIRIRef( v )) return {key: v, value: v, text: v}
  } ))

  // @ts-ignore
  return <Form.Dropdown {...props} options={options}/>
}

const validator = {
  required: ( value: any ) => value === undefined || value === null ? 'required form filed' : undefined,
  matchesPattern: ( pattern: string,value: any ) => typeof value === 'string' ? ( new RegExp( pattern ).test( value ) ? undefined : `the input must follow the pattern ${pattern}` ) : undefined
}

const tripleConstraintShapeExpr = {
  Shape: ( {context, shape, tripleConstraint, label, zeroOrOne}: TripleConstraintShapeExprProps & { shape: Shape } ) => {
    return shape.expression
      ? <Container shapeName='Shape' style={{border: 'solid 1px black'}}>
        <TripleExprSwitch context={context} expr={shape.expression}/>
      </Container>
      : null
  },
  ShapeOr: ( {context, shape}: TripleConstraintShapeExprProps & { shape: ShapeOr } ) => {
    return <Container shapeName='ShapeOr' notImplemented/>
  },
  ShapeAnd: ( {context, shape}: TripleConstraintShapeExprProps & { shape: ShapeAnd } ) => {
    return <Container shapeName='ShapeAnd' notImplemented/>
  },
  ShapeExternal: ( {context, shape}: TripleConstraintShapeExprProps & { shape: ShapeExternal } ) => {
    return <Container shapeName='ShapeExternal' notImplemented/>
  },
  ShapeNot: ( {context, shape}: TripleConstraintShapeExprProps & { shape: ShapeNot } ) => {
    return <Container shapeName='ShapeNot' notImplemented/>
  },
  NodeConstraint: ( {context, shape, tripleConstraint, zeroOrOne}: TripleConstraintShapeExprProps & { shape: NodeConstraint } ) => {
    const label = iri2Label( tripleConstraint.predicate )
    const data = useData( context )
    const handleChange = useCallback(
      ( _data, isIRI ) => {
        context.events.onChange( context, {value: _data, isIRI} )
      },
      [context] )
    const handleRemove = useCallback(
      () => {
        context.events.onRemove( context, {predicate: tripleConstraint.predicate} )
      },
      [context] )

    if ( shape.nodeKind === 'iri' ) {
      const error = filterUndefOrNull( [
        !zeroOrOne ? validator.required( data ) : undefined,
        ( shape.pattern ? validator.matchesPattern( shape.pattern, data ) : undefined )] )
      return <Container shapeName='triple NodeConstraint'>
        <IRIChooser
          onChange={data => handleChange( data, true )}
          onRemove={() => handleRemove()}
          allowDelete={zeroOrOne}
          value={data}
          label={label}
          error={error.length > 0 ? error : undefined}
          baseURI={context.baseURI}/>
      </Container>
    } else {
      return <Container shapeName='triple NodeConstraint'>
        {shape.datatype &&
          <PrimitiveForm
            datatype={shape.datatype}
            label={label}
            allowDelete={zeroOrOne}
            value={data?.['@value'] || null}
            onChange={data => handleChange( data, false )}
            onRemove={() => handleRemove()}/>}
        {shape.values &&
          <ValuesDropdown values={shape.values} label={label}/>}
      </Container>
    }
  },
}

const shapeExpressions = {
  Shape: ( {context, shape}: { context: Context, shape: Shape } ) => {
    return shape.expression
      ? <Container shapeName='Shape'>
        <TripleExprSwitch context={context} expr={shape.expression}/>
      </Container>
      : null
  },
  ShapeOr: ( {context, shape}: { context: Context, shape: ShapeOr } ) => {
    return <Container shapeName='ShapeOr' notImplemented/>
  },
  ShapeAnd: ( {context, shape}: { context: Context, shape: ShapeAnd } ) => {
    return <Container shapeName='ShapeAnd' notImplemented/>
  },
  ShapeExternal: ( {context, shape}: { context: Context, shape: ShapeExternal } ) => {
    return <Container shapeName='ShapeExternal' notImplemented/>
  },
  ShapeNot: ( {context, shape}: { context: Context, shape: ShapeNot } ) => {
    return <Container shapeName='ShapeNot' notImplemented/>
  },
  NodeConstraint: ( {context, shape}: { context: Context, shape: NodeConstraint } ) => {
    return <Container shapeName='NodeConstraint' notImplemented/>
  }
}

const useData: ( context: { rdfDocument: object, path: PathComponent[] } ) => any = ( context ) => {
  const {rdfDocument, path} = context
  const [data, setData] = useState<any>()
  useEffect(() => {
    const [, ...path_] = path
    setData( getSubTreeByPath( rdfDocument, path_ ))
  }, [rdfDocument, path, setData] )
  return data
}

const makeKey: ( path: PathComponent[] ) => string = path => [...path].join( '.' )

type triplExprProps = {
  context: Context
}

const triplExpr = {
  EachOf: ( {context, expr}: triplExprProps & { expr: EachOf } ) => {
    return <Container shapeName='EachOf'>
      {expr.expressions.map(( expr, i ) => <Fragment key={makeKey( [...context.path, i] )}>{
        <TripleExprSwitch context={context} expr={expr}/>
      }</Fragment> )}
    </Container>
  },
  OneOf: ( {context, expr}: triplExprProps & { expr: OneOf } ) => {
    const [currentOption, setCurrentOption] = useState( 0 )
    const options = expr.expressions.map(( _1, i ) => ( {key: i, value: i, text: `Option ${i}`} ))
    const currentExpr = expr.expressions[currentOption]
    const handleChange = useCallback(
      ( value: number ) => {
        setCurrentOption( value )
        context.events.onRemove( context, {predicate: ( currentExpr as any )?.predicate as string} )
      },
      [setCurrentOption, currentExpr] )

    return <Container shapeName='OneOf'>
      <FormDropdown
        label={'one of'}
        options={options}
        onChange={( _e, data ) => handleChange( data.value as number )}
        value={currentOption}/>
      {currentExpr && <TripleExprSwitch context={context} expr={currentExpr}/>}
    </Container>
  },
  TripleConstraint: ( {context, expr}: triplExprProps & { expr: TripleConstraint } ) => {
    const valueExpr = expr.valueExpr && (
      typeof expr.valueExpr === 'string'
        ? context.schema.shapes?.find(( {id} ) => id === expr.valueExpr )?.shapeExpr
        : expr.valueExpr
    )

    return <Container shapeName='Triple Constraint'>
      {valueExpr &&
        <TripleConstraintShapeExprContainer context={context} tripleConstraint={expr} valueExpr={valueExpr} />}
    </Container>
  }
}

type MultiPropertyContainerProps = {
  min: number
  max: number
  data?: any[]
  valueExpr: shapeExpr
  label?: string
} & TripleConstraintShapeExprProps


const MultiPropertyContainer = ( props: MultiPropertyContainerProps ) => {
  const {min, max, tripleConstraint, valueExpr, context, data, label} = props
  const count = data?.length || 0

  //TODO: how do we no if its an IRI? important!!!!
  const isIRI = valueExpr.type === 'NodeConstraint' && valueExpr.nodeKind === 'iri'

  return <div className='multiple_property_container' style={{margin: '1em 0'}}>
    {data && data.length > 0 && <Segment.Group>
      {data.map(( object, index ) => {
        const newContext = updatePath( context, index )
        const _key = makeKey( newContext.path ) //(( data as any ).__key || '' )
        return <Segment key={_key} style={{display: 'flex'}}>
          <Label ribbon style={{position: 'absolute'}}>
            <>
              {label}
              <Icon link name='close' size='tiny'
                onClick={() => context.events.onRemove( newContext, {predicate: tripleConstraint.predicate, object} )}/>
            </>
          </Label>
          <div  style={{marginTop: '2rem'}}>
            <TripleConstraintShapeExprSwitch context={newContext}
              tripleConstraint={tripleConstraint} valueExpr={valueExpr}/>
          </div>
        </Segment>
      }
      )}
    </Segment.Group>}
    <Button
      labelPosition='left'
      content={label}
      icon='add'
      disabled={max !== -1 && count >= max}
      onClick={() => context.events.onAddEmptyElement( updatePath( context, count ), isIRI )}/>
  </div>
}

const TripleConstraintShapeExprContainer = ( {
  context,
  tripleConstraint,
  valueExpr
}: TripleConstraintShapeExprProps & { valueExpr: shapeExpr } ) => {
  const {min = 1, max = 1} = tripleConstraint
  const exactlyOne = min === 1 && max === 1
  const zeroOrOne = min === 0 && max === 1
  const predicateContext = updatePath( context, tripleConstraint.predicate )
  const firstElementContext = updatePath( predicateContext, 0 )
  const data = useData( predicateContext )

  const label = iri2Label( tripleConstraint.predicate )

  return <div>{
    exactlyOne || zeroOrOne
      ? <TripleConstraintShapeExprSwitch
        label={label}
        zeroOrOne={zeroOrOne}
        context={firstElementContext}
        tripleConstraint={tripleConstraint}
        valueExpr={valueExpr}/>
      : <MultiPropertyContainer
        label={label}
        min={min}
        max={max}
        data={data as any[]}
        tripleConstraint={tripleConstraint}
        valueExpr={valueExpr}
        context={predicateContext}
      />
  }</div>
}

const TripleExprSwitch = ( {context, expr}: triplExprProps & { expr: tripleExprOrRef } ) => {
  if ( typeof expr !== 'object' )
    throw new Error( 'Triple Expression IRI Ref not yet implemented' )
  switch ( expr.type ) {
  case 'EachOf':
    return triplExpr.EachOf( {context, expr} )
  case 'OneOf':
    return triplExpr.OneOf( {context, expr} )
  case 'TripleConstraint':
    return triplExpr.TripleConstraint( {context, expr} )
  }
}

const TripleConstraintShapeExprSwitch = ( { valueExpr, ...props } : TripleConstraintShapeExprProps & { valueExpr: shapeExpr } ) => {
  switch ( valueExpr.type ) {
  case 'Shape':
    return tripleConstraintShapeExpr.Shape( {...props, shape: valueExpr} )
  case 'ShapeAnd':
    return tripleConstraintShapeExpr.ShapeAnd( {...props, shape: valueExpr} )
  case 'ShapeOr':
    return tripleConstraintShapeExpr.ShapeOr( {...props ,shape: valueExpr} )
  case 'ShapeNot':
    return tripleConstraintShapeExpr.ShapeNot( {...props, shape: valueExpr} )
  case 'ShapeExternal':
    return tripleConstraintShapeExpr.ShapeExternal( {...props, shape: valueExpr} )
  case 'NodeConstraint':
    return tripleConstraintShapeExpr.NodeConstraint( {...props, shape: valueExpr} )
  }
}

const ShapeExprSwitch = ( {context, shapeDecl}: ShapeDeclProps ) => {
  switch ( shapeDecl.shapeExpr.type ) {
  case 'Shape':
    return shapeExpressions.Shape( {context, shape: shapeDecl.shapeExpr} )
  case 'ShapeAnd':
    return shapeExpressions.ShapeAnd( {context, shape: shapeDecl.shapeExpr} )
  case 'ShapeOr':
    return shapeExpressions.ShapeOr( {context, shape: shapeDecl.shapeExpr} )
  case 'ShapeNot':
    return shapeExpressions.ShapeNot( {context, shape: shapeDecl.shapeExpr} )
  case 'ShapeExternal':
    return shapeExpressions.ShapeExternal( {context, shape: shapeDecl.shapeExpr} )
  case 'NodeConstraint':
    return shapeExpressions.NodeConstraint( {context, shape: shapeDecl.shapeExpr} )
  }
}
const ShapeDeclComponent = ( {context, shapeDecl}: ShapeDeclProps ) => {
  return <Container shapeName='ShapeDecl'>
    <ShapeExprSwitch context={context} shapeDecl={shapeDecl}/>
  </Container>
}

export default ShexForm

