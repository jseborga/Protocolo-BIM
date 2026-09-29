# Conectar herramientas externas con una clave de API

Protocolo BIM expone una API REST en `/api/v1` para que otras herramientas —
el complemento de Revit (en preparación), scripts de PowerShell o Python,
Dynamo, Power BI— lean el estándar de un proyecto y le envíen auditorías de
modelos. Cada herramienta se identifica con una **clave de API** del proyecto,
nunca con el usuario y la contraseña de una persona.

El contrato completo, en formato OpenAPI 3.1, está en
`https://<tu-servidor>/api/v1/openapi.json`. Se puede importar tal cual en
Postman, Insomnia o Swagger Editor, o usar para generar un cliente (C#,
Python…).

---

## 1. Preparar el proyecto en la web

La API sirve lo que el proyecto tiene definido, así que antes de conectar nada:

1. **Datos del proyecto** (*Ajustes → General*): código, nombre, dirección.
   Salen en la *Información del proyecto* que se compara con el modelo.
2. **Cliente**: la razón social se indica al crear el proyecto y aparece en su
   panel; es el *Nombre del cliente* esperado en el modelo.
3. **Nomenclatura** (*Nomenclatura*): activa las convenciones que quieras
   hacer cumplir (archivos, planos, vistas, familias, tipos, parámetros,
   subproyectos, niveles, rejillas). Solo las **activas** se usan para auditar.
4. **Parámetros y subproyectos** (*Parámetros*): revisa los parámetros
   compartidos (con su GUID fijo), las categorías a las que se vinculan, si son
   obligatorios, y los subproyectos (*worksets*) del estándar.

## 2. Crear la clave de API

1. Entra con una cuenta que pueda gestionar el proyecto (propietario o
   administrador de la organización, o *Information Manager* / *BIM Manager*
   del proyecto).
2. Ve a **Ajustes del proyecto → Conexión externa (claves de API)**.
3. Escribe un nombre que diga quién la usa (p. ej. `Revit — Equipo de
   Arquitectura` o `Power BI — Dirección`).
4. Elige la caducidad (30, 90 o 365 días, o sin caducidad).
5. Marca los permisos:
   - **Leer el estándar del proyecto** (`standard:read`): descargar el
     estándar y el archivo de parámetros compartidos, validar nombres, leer
     auditorías.
   - **Enviar auditorías de modelos** (`audit:write`): registrar auditorías
     (y leerlas).
6. Pulsa **Crear clave de API**.
7. **Copia la clave en ese momento**: la web solo guarda su huella (hash) y no
   la volverá a mostrar. Si se pierde, se anula y se crea otra.

La pantalla muestra también la **dirección del servidor** y dos comandos de
prueba listos para copiar.

> Una clave abre **un solo proyecto**. Crea una por equipo o por herramienta:
> así puedes anular una sin cortar a las demás. En la tabla de claves se ve
> cuándo se usó cada una por última vez.

## 3. Probar la conexión

La clave se envía en cada petición, en una de estas dos cabeceras:

```
Authorization: Bearer pbim_XXXXXXXX_...
X-API-Key: pbim_XXXXXXXX_...
```

**Windows (PowerShell)** — sirve tanto Windows PowerShell 5.1 como PowerShell 7:

```powershell
$Server = "https://bim.tuempresa.com"          # dirección del servidor
$Key    = "pbim_XXXXXXXX_..."                  # la clave copiada
$Headers = @{ Authorization = "Bearer $Key" }

$conn = Invoke-RestMethod -Uri "$Server/api/v1/connection" -Headers $Headers
$conn.project        # id, código, nombre y organización del proyecto
$ProjectId = $conn.project.id
```

**macOS / Linux / Windows (curl.exe):**

```bash
curl -H "Authorization: Bearer pbim_XXXXXXXX_..." https://bim.tuempresa.com/api/v1/connection
```

> En Windows PowerShell 5.1, `curl` es un alias de `Invoke-WebRequest`; para
> usar el curl real escribe `curl.exe`.

Respuestas posibles:

| Código | Significado |
| --- | --- |
| 200 | La clave funciona. `project.id` es el identificador que usan las demás rutas. |
| 401 `invalid_token` | Falta la clave, está mal copiada, fue anulada o caducó. |
| 403 `insufficient_scope` | La clave no tiene el permiso que pide esa ruta. |
| 404 `not_found` | El proyecto de la URL no es el de la clave. |

## 4. Usar la API

Todas las rutas cuelgan de `https://<servidor>/api/v1/projects/<ProjectId>`.
Los mensajes (errores de nomenclatura, hallazgos) vienen en el idioma que pidas
con `?locale=es|en|pt`, o en el de la cabecera `Accept-Language`, o en el del
proyecto.

### Descargar el estándar

```powershell
$std = Invoke-RestMethod -Uri "$Server/api/v1/projects/$ProjectId/standard" -Headers $Headers
$std.naming.conventions | Select-Object key, target, mask
$std.sharedParameters.parameters | Select-Object name, guid, dataType, isInstance
$std.worksets | Select-Object name
$std.ruleSet.version
```

El documento incluye la *Información del proyecto*, las convenciones de
nomenclatura activas (con su expresión regular), los parámetros compartidos con
GUID, tipo (`SpecTypeId`), grupo (`GroupTypeId`) y categorías, y los
subproyectos. Tiene una **versión** que solo cambia cuando cambian las reglas.
La respuesta trae una cabecera `ETag`: si la reenvías en `If-None-Match`, el
servidor contesta `304` cuando nada ha cambiado.

### Descargar el archivo de parámetros compartidos de Revit

```powershell
Invoke-WebRequest -Uri "$Server/api/v1/projects/$ProjectId/shared-parameters.txt" `
  -Headers $Headers -OutFile "C:\BIM\parametros-compartidos.txt"
```

Es el mismo formato que escribe Revit (UTF-16 LE, CRLF). En Revit:
*Gestionar → Parámetros compartidos → Examinar* y seleccionar el archivo.

### Validar nombres sin registrar nada

```powershell
$body = @{ items = @(
  @{ target = 'SHEET';   name = 'ARC-00-001' },
  @{ target = 'WORKSET'; name = 'Fachadas' }
) } | ConvertTo-Json -Depth 10

$res = Invoke-RestMethod -Method Post -Uri "$Server/api/v1/projects/$ProjectId/naming/validate?locale=es" `
  -Headers $Headers -ContentType 'application/json; charset=utf-8' `
  -Body ([Text.Encoding]::UTF8.GetBytes($body))
$res.results | Select-Object name, valid, messages
```

Objetivos (`target`) válidos: `FILE`, `MODEL`, `SHEET`, `VIEW`, `FAMILY`,
`TYPE`, `PARAMETER`, `WORKSET`, `LEVEL`, `GRID`. Hasta 5 000 nombres por
llamada.

### Enviar una auditoría de un modelo

La herramienta informa de **lo que contiene el modelo**; el servidor lo juzga
con las reglas vigentes, guarda el resultado y lo devuelve. Las partes que no
envíes no se comprueban.

```powershell
$audit = @{
  model = @{ title = 'EDI-JSE-ZZ-XX-M3-A-0001'; isWorkshared = $true; revitVersion = '2026' }
  ruleSetVersion = $std.ruleSet.version
  names = @(
    @{ target = 'SHEET';  name = 'ARC-00-001'; elementId = '312456'; category = 'OST_Sheets' },
    @{ target = 'VIEW';   name = 'Planta nivel 0' },
    @{ target = 'FAMILY'; name = 'ARC_Puerta_Simple' }
  )
  sharedParameters = @(
    @{ name = 'GEN_Originador'; guid = '7668ad9f-7aa3-47a1-ad54-32c4d1626dbd'; isInstance = $true;
       categories = @('OST_Walls', 'OST_Doors') }
  )
  worksets = @('ARC_General', 'GEN_Niveles y rejillas')
  projectInformation = @{ name = 'Edificio Corporativo Alameda'; number = 'EDI'; clientName = 'Cliente SA' }
} | ConvertTo-Json -Depth 10

$run = Invoke-RestMethod -Method Post -Uri "$Server/api/v1/projects/$ProjectId/audit-runs?locale=es" `
  -Headers $Headers -ContentType 'application/json; charset=utf-8' `
  -Body ([Text.Encoding]::UTF8.GetBytes($audit))

$run.summary                                   # comprobados, errores, avisos
$run.findings | Select-Object severity, target, elementName, message
$run.webUrl                                    # la auditoría en la web (Calidad)
```

Qué se comprueba:

| Parte enviada | Comprobación |
| --- | --- |
| `names` | Cada nombre contra las convenciones activas de su objetivo. |
| `sharedParameters` | Que estén los obligatorios, con el GUID correcto, vinculados a sus categorías y como ejemplar/tipo según el estándar. |
| `worksets` | Que existan los subproyectos del estándar (si el modelo es colaborativo). |
| `projectInformation` | Nombre, número y cliente contra los datos del proyecto. |

El resultado aparece en la web en **Calidad** (lista de auditorías con el
detalle de cada hallazgo, filtrable por gravedad y objetivo).

### Consultar auditorías

```powershell
# Las más recientes (hasta 100 por página; usa nextCursor para seguir)
$list = Invoke-RestMethod -Uri "$Server/api/v1/projects/$ProjectId/audit-runs?limit=20" -Headers $Headers
$list.runs | Select-Object startedAt, modelName, errors, warnings

# Una en concreto, con todos sus hallazgos
Invoke-RestMethod -Uri "$Server/api/v1/projects/$ProjectId/audit-runs/$($run.run.id)" -Headers $Headers
```

## 5. Referencia rápida

| Método | Ruta | Permiso |
| --- | --- | --- |
| GET | `/api/v1/connection` | cualquiera |
| GET | `/api/v1/openapi.json` | público |
| GET | `/api/v1/projects/{id}/standard` | `standard:read` |
| GET | `/api/v1/projects/{id}/shared-parameters.txt` | `standard:read` |
| POST | `/api/v1/projects/{id}/naming/validate` | `standard:read` |
| GET | `/api/v1/projects/{id}/audit-runs` | `standard:read` o `audit:write` |
| POST | `/api/v1/projects/{id}/audit-runs` | `audit:write` |
| GET | `/api/v1/projects/{id}/audit-runs/{runId}` | `standard:read` o `audit:write` |

Límites: cuerpo de hasta 25 MB (`413` si se supera), 200 000 nombres por
auditoría, 5 000 por validación. Un cuerpo que no es JSON devuelve `400`; uno
que no cumple el esquema, `422` con el campo concreto en `message`.

## 6. Seguridad

- Trata la clave como una contraseña: no la subas a repositorios ni la pegues
  en chats. Guárdala en un gestor de secretos o en una variable de entorno.
- Usa siempre HTTPS en producción (Easypanel lo configura con el dominio).
- El servidor guarda solo el hash SHA-256 de la clave; ni los administradores
  pueden recuperarla.
- Anular una clave (*Ajustes → Anular*) corta el acceso al instante.
- Las auditorías registran qué clave las envió.
