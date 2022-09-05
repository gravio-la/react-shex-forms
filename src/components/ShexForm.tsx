import './main.css'

import * as xsd from '@ontologies/xsd'
// @ts-ignore
import shexCore from '@shexjs/core'
import shexParser from '@shexjs/parser'
import React, {Fragment,useCallback, useEffect, useState} from 'react'
import {
  Dropdown,
  Form,
  FormDropdown,
  Label,
  StrictFormDropdownProps,
  StrictFormFieldProps
} from 'semantic-ui-react'
import {
  EachOf, IRIREF,
  NodeConstraint, ObjectLiteral, OneOf,
  Schema,
  Shape,
  ShapeAnd,
  ShapeDecl, shapeExpr,
  ShapeExternal,
  ShapeNot,
  ShapeOr, TripleConstraint,
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
const debugVerbose = true


type ContainerProps = React.BaseHTMLAttributes<HTMLDivElement> & {
  shapeName?: string
  shape?: any
  notImplemented?: boolean
  children?: React.ReactNode
}
const Container = ( {children, shapeName, notImplemented}: ContainerProps ) => {
  return <div>
    <span style={{display: !debugVerbose || notImplemented ? 'none': 'unset'}}>{shapeName || null}{notImplemented && 'not implemented'}</span>
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

const applyChangeToRDF: ( doc: any, path: PathComponent[], value: any ) => ( any ) = ( doc: any, path: PathComponent[], value: any )  => {
  //TODO this will not be very general, it assumes a certain shape of the jsonld and only supports extened jsonld
  if( path.length === 0 ) {
    return { '@value': value }
  }
  const [pathEl, ... restPath] = path
  if(  typeof pathEl === 'number' ) {
    const doc_ = doc || []
    if( !Array.isArray( doc_ )) {
      throw new Error( 'cannot descant into an object, as path component is not a number' )
    }
    if( doc_.length > pathEl ) {
      const descendantDoc = doc_[pathEl]
      return doc_.map(( element: any, i ) => {
        if( i === pathEl ) return applyChangeToRDF( descendantDoc, restPath, value )
        return element
      } )
    } else {
      return [...doc_, applyChangeToRDF( null, restPath, value ) ]
    }
  } else {
    const doc_ = doc || {}
    const descendantDoc = doc_[pathEl] || []
    //if( !descendantDoc ) {
    //  throw new Error( 'cannot apply update, path does not exist' )
    //}
    return {
      ...doc_,
      [pathEl]: applyChangeToRDF( descendantDoc, restPath, value )
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

  const [rdfDocument, setRdfDocument] = useState<{[k: string]: any}>( {
    '@id': rootURI
  } )

  useEffect(() => {
    if( !startShape ) {
      setShowStartShapeChooser( true )
      if( schema?.shapes ) {
        setStartShape( schema.shapes[0] )
      }
    }
  }, [schema, startShape, setStartShape, setShowStartShapeChooser] )


  useEffect(() => {
    if( typeof shexDocument === 'string' ) {
      const parser = shexParser.construct( baseURI )
      const parsedAS = parser.parse( shexDocument )
      const shexJ = shexCore.Util.AStoShExJ( parsedAS )
      setShexj( shexJ as Schema )
    } else {
      setShexj( shexDocument )
    }
  }, [shexDocument, baseURI] )

  useEffect(() => {
    if( schema && startShapeURI ) {
      setShowStartShapeChooser( false )

    }
  }, [schema, startShapeURI] )


  const handleChange = useCallback<OnChangeEvent>(( context, change ) =>  {
    console.log( {path: context.path, change} )
    try {
      const [, ...path] = context.path
      const newDoc = applyChangeToRDF( rdfDocument, path, change.value )
      console.log( {newDoc} )
      setRdfDocument( newDoc )

    } catch ( e ) {
      console.log( e )
    }
  }, [rdfDocument, setRdfDocument] )

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
              onChange: handleChange
            }
          }}
          shapeDecl={startShape} />
      </Form>}
    </div>
  )
}

type AtomicChange = {
  value: any
}

type OnChangeEvent = ( context: Context, data: AtomicChange, originalEvent?: Event ) => void

type PathComponent = string | number

type Context = {
  schema: Schema,
  rdfDocument: object,
  path: PathComponent[],
  baseURI: string,
  events: {
    onChange: OnChangeEvent
  }
}

type ShapeDeclProps = {
  context: Context,
  shapeDecl: ShapeDecl

}

type TripleConstraintShapeExprProps  = {
  context: Context,
  tripleConstraint: TripleConstraint
}

type IRIChooserProps = {
  baseURI: string
} & StrictFormFieldProps

const IRIChooser = ( {baseURI, ...props}: IRIChooserProps ) => {
  const [iri, setIri] = useState( `${baseURI}#${uuidv4()}` )
  return  <Form.Input
    {...props}
    type="text"
    value={iri}
    onChange={e => setIri( e.target.value )}
  />

}

const PrimitiveForm = ( {datatype, onChange, value, ...props}: {datatype: string, onChange: ( data: any ) => void, value: any} & StrictFormFieldProps ) => {
  switch ( datatype ) {
  case xsd.string.value:
    return  <Form.Input
      {...props}
      type="text"
      onChange={ e => onChange( e.target.value )}
      value={value || ''}
    />
  case xsd.integer.value:
    return  <Form.Input
      {...props}
      onChange={ e => onChange( e.target.value )}
      value={value || ''}
      type="number"
    />
  case xsd.xsdboolean.value:
    return  <Form.Checkbox
      {...props}
      type="checkbox"
      onChange={ ( _e, data ) => onChange( data.checked )}
      checked={value || false}
    />
  default:
    return <Container notImplemented>other xsd</Container>
  }

}

const isObjectLiteral = ( value: valueSetValue ): value is ObjectLiteral => typeof ( value as any ).value === 'string'
const isIRIREF = ( value: valueSetValue ): value is IRIREF => typeof value === 'string'

const updatePath = ( {path, ...context}: Context, ...pathElements: PathComponent[] ) => ( {path: [...path, ...pathElements], ...context} )

const ValuesDropdown = ( {values, ...props}: {values: valueSetValue[]} & StrictFormDropdownProps ) => {
  const options =  filterUndefOrNull( values.map( v => {
    if( isObjectLiteral( v )) return {key: v.value, value: v.value, text: v.value}
    if( isIRIREF( v )) return {key: v, value: v, text: v}
  } ))

  // @ts-ignore
  return <Form.Dropdown {...props} options={options} />
}

const tripleConstraintShapeExpr  = {
  Shape: ( {context, shape, tripleConstraint}: TripleConstraintShapeExprProps & { shape: Shape} ) => {
    const label = iri2Label( tripleConstraint.predicate )
    return <Container shapeName='Shape' style={{border: 'solid 1px black'}}>
      <Label>{label}</Label>
      {
        // @ts-ignore
        shape.expression?.type && triplExpr[shape.expression.type]( { context , expr: shape.expression  } ) || null
      }
    </Container>
  },
  ShapeOr: ( {context, shape}: TripleConstraintShapeExprProps & { shape: ShapeOr} ) => {
    return <Container shapeName='ShapeOr' notImplemented />
  },
  ShapeAnd: ( {context, shape}: TripleConstraintShapeExprProps & { shape: ShapeAnd} ) => {
    return <Container shapeName='ShapeAnd' notImplemented />
  },
  ShapeExternal: ( {context, shape}: TripleConstraintShapeExprProps & { shape: ShapeExternal} ) => {
    return <Container shapeName='ShapeExternal' notImplemented />
  },
  ShapeNot: ( {context, shape}: TripleConstraintShapeExprProps & { shape: ShapeNot} ) => {
    return <Container shapeName='ShapeNot' notImplemented />
  },
  NodeConstraint: ( {context, shape, tripleConstraint}: TripleConstraintShapeExprProps & { shape: NodeConstraint} ) => {
    const label = iri2Label( tripleConstraint.predicate )
    const [value, setValue] = useState<any>( null )
    const handleChange = useCallback(
      ( data ) => {
        setValue( data )
        context.events.onChange( context, {value: data} )
      },
      [setValue, context] )

    if( shape.nodeKind === 'iri' ) {
      return <Container shapeName='triple NodeConstraint'>
        <IRIChooser label={label} baseURI={context.baseURI}/>
      </Container>
    } else {
      return <Container shapeName='triple NodeConstraint' >
        {shape.datatype &&
          <PrimitiveForm
            datatype={shape.datatype}
            label={label}
            value={value}
            onChange={handleChange} />}
        {shape.values &&
          <ValuesDropdown values={shape.values} label={label}/>}
      </Container>
    }
  },
}

const shapeExpressions  = {
  Shape: ( {context, shape}: {context: Context, shape: Shape} ) => {
    return <Container shapeName='Shape'>
      {
        // @ts-ignore
        shape.expression?.type && triplExpr[shape.expression.type]( { context, expr: shape.expression } ) || null
      }
    </Container>
  },
  ShapeOr: ( {context, shape}: {context: Context, shape: ShapeOr} ) => {
    return <Container shapeName='ShapeOr' notImplemented />
  },
  ShapeAnd: ( {context, shape}: {context: Context, shape: ShapeAnd} ) => {
    return <Container shapeName='ShapeAnd' notImplemented />
  },
  ShapeExternal: ( {context, shape}: {context: Context, shape: ShapeExternal} ) => {
    return <Container shapeName='ShapeExternal' notImplemented />
  },
  ShapeNot: ( {context, shape}: {context: Context, shape: ShapeNot} ) => {
    return <Container shapeName='ShapeNot' notImplemented />
  },
  NodeConstraint: ( {context, shape}: {context: Context, shape: NodeConstraint} ) => {
    return <Container shapeName='NodeConstraint' notImplemented />
  }
}

const triplExpr = {
  EachOf: ( {context, expr }: {context: Context, expr: EachOf} ) => {
    return <Container shapeName='EachOf' notImplemented>
      {expr.expressions.map(( e, i ) => <Fragment key={[...context.path, i].join( '.' )}>{
        // @ts-ignore
        e && e.type && triplExpr[e.type]( { context, expr: e } ) || null
      }</Fragment> )}
    </Container>
  },
  OneOf: ( {context, expr }: {context: Context, expr: OneOf} ) => {
    const [currentOption, setCurrentOption] = useState( 0 )
    const options = expr.expressions.map(( _1, i ) => ( {key: i, value: i, text: `Option ${i}`} ))
    const currentExpr = expr.expressions[currentOption]
    return <Container shapeName='OneOf'>
      <FormDropdown
        label={'one of'}
        options={options}
        onChange={( _e,data ) => setCurrentOption( data.value as number )}
        value={currentOption} />
      {currentExpr && typeof currentExpr !== 'string' &&  currentExpr.type && triplExpr[currentExpr.type]( { context, expr: currentExpr as never } )}
    </Container>
  },
  TripleConstraint: ( {context, expr}: {context: Context, expr: TripleConstraint} ) => {
    const valueExpr =  expr.valueExpr && (
      typeof expr.valueExpr === 'string'
        ?  context.schema.shapes?.find(( {id} ) => id === expr.valueExpr )?.shapeExpr
        : expr.valueExpr
    )

    return <Container shapeName='Triple Constraint'>
      {valueExpr && <TripleConstraintShapeExprSwitch context={context} tripleConstraint={expr} valueExpr={valueExpr} />}
    </Container>
  }
}



const TripleConstraintShapeExprSwitch = ( {context: context_, tripleConstraint, valueExpr}: TripleConstraintShapeExprProps & {valueExpr: shapeExpr} ) => {

  //TODO: min, max
  const context = updatePath( context_, tripleConstraint.predicate, 0 )
  switch ( valueExpr.type ) {
  case 'Shape':
    return tripleConstraintShapeExpr.Shape( {context, tripleConstraint, shape: valueExpr} )
  case 'ShapeAnd':
    return tripleConstraintShapeExpr.ShapeAnd( {context, tripleConstraint, shape: valueExpr} )
  case 'ShapeOr':
    return tripleConstraintShapeExpr.ShapeOr( {context, tripleConstraint, shape: valueExpr} )
  case 'ShapeNot':
    return tripleConstraintShapeExpr.ShapeNot( {context, tripleConstraint, shape: valueExpr} )
  case 'ShapeExternal':
    return tripleConstraintShapeExpr.ShapeExternal( {context, tripleConstraint, shape: valueExpr} )
  case 'NodeConstraint':
    return tripleConstraintShapeExpr.NodeConstraint( {context, tripleConstraint, shape: valueExpr} )
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
    <ShapeExprSwitch context={context} shapeDecl={shapeDecl} />
  </Container>
}

export default ShexForm

