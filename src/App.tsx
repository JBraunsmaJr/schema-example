import './App.css'
import {Box, Container, Typography} from "@mui/material";
import testSchema from "./test-schema.json"
import { DynamicForm } from "./schema/DynamicForm"

function App() {
    console.log(testSchema)

    const handleFormSubmit = (data: Record<string, unknown>) => {
        console.log("Form Submited", data)
        alert(JSON.stringify(data, null, 2))
    }

  return (
      <Container maxWidth="sm">
          <Box sx={{my: 4}}>
              <Typography variant="h4" component="h1" sx={{mb: 2}}>
                  Platform Example
              </Typography>

              <DynamicForm
                onSubmit={handleFormSubmit}
                schema={testSchema}
              />
          </Box>
      </Container>
  )
}

export default App
