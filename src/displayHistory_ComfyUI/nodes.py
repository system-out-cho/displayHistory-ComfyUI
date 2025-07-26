from inspect import cleandoc
from server import PromptServer
import torch
import time
from aiohttp import web
import folder_paths


class Example:
    """
    A example node

    Class methods
    -------------
    INPUT_TYPES (dict):
        Tell the main program input parameters of nodes.
    IS_CHANGED:
        optional method to control when the node is re executed.

    Attributes
    ----------
    RETURN_TYPES (`tuple`):
        The type of each element in the output tulple.
    RETURN_NAMES (`tuple`):
        Optional: The name of each output in the output tulple.
    FUNCTION (`str`):
        The name of the entry-point method. For example, if `FUNCTION = "execute"` then it will run Example().execute()
    OUTPUT_NODE ([`bool`]):
        If this node is an output node that outputs a result/image from the graph. The SaveImage node is an example.
        The backend iterates on these output nodes and tries to execute all their parents if their parent graph is properly connected.
        Assumed to be False if not present.
    CATEGORY (`str`):
        The category the node should appear in the UI.
    execute(s) -> tuple || None:
        The entry point method. The name of this method must be the same as the value of property `FUNCTION`.
        For example, if `FUNCTION = "execute"` then this method's name must be `execute`, if `FUNCTION = "foo"` then it must be `foo`.
    """
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        """
            Return a dictionary which contains config for all input fields.
            Some types (string): "MODEL", "VAE", "CLIP", "CONDITIONING", "LATENT", "IMAGE", "INT", "STRING", "FLOAT".
            Input types "INT", "STRING" or "FLOAT" are special values for fields on the node.
            The type can be a list for selection.

            Returns: `dict`:
                - Key input_fields_group (`string`): Can be either required, hidden or optional. A node class must have property `required`
                - Value input_fields (`dict`): Contains input fields config:
                    * Key field_name (`string`): Name of a entry-point method's argument
                    * Value field_config (`tuple`):
                        + First value is a string indicate the type of field or a list for selection.
                        + Secound value is a config for type "INT", "STRING" or "FLOAT".
        """
        return {
            "required": {
                "image": ("Image", { "tooltip": "This is an image"}),
                "int_field": ("INT", {
                    "default": 0,
                    "min": 0, #Minimum value
                    "max": 4096, #Maximum value
                    "step": 64, #Slider's step
                    "display": "number" # Cosmetic only: display as "number" or "slider"
                }),
                "float_field": ("FLOAT", {
                    "default": 1.0,
                    "min": 0.0,
                    "max": 3,
                    "step": 0.01,
                    "round": 0.001, #The value represeting the precision to round to, will be set to the step value by default. Can be set to False to disable rounding.
                    "display": "number"}),
                "print_to_screen": (["enable", "disable"],),
                "string_field": ("STRING", {
                    "multiline": False, #True if you want the field to look like the one on the ClipTextEncode node
                    "default": "Hello World!"
                }),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    #RETURN_NAMES = ("image_output_name",)
    DESCRIPTION = cleandoc(__doc__)
    FUNCTION = "test"

    #OUTPUT_NODE = False
    #OUTPUT_TOOLTIPS = ("",) # Tooltips for the output node

    CATEGORY = "Example"

    def test(self, image, string_field, int_field, float_field, print_to_screen):
        if print_to_screen == "enable":
            print(f"""Your input contains:
                string_field aka input text: {string_field}
                int_field: {int_field}
                float_field: {float_field}
            """)
        #do some processing on the image, in this example I just invert it
        image = 1.0 - image
        return (image,)

    """
        The node will always be re executed if any of the inputs change but
        this method can be used to force the node to execute again even when the inputs don't change.
        You can make this node return a number or a string. This value will be compared to the one returned the last time the node was
        executed, if it is different the node will be executed again.
        This method is used in the core repo for the LoadImage node where they return the image hash as a string, if the image hash
        changes between executions the LoadImage node is executed again.
    """
    #@classmethod
    #def IS_CHANGED(s, image, string_field, int_field, float_field, print_to_screen):
    #    return ""

class DisplayHistory:

    CATEGORY = "example"
    @classmethod    
    def INPUT_TYPES(s):
        return { "required": {"node": (["No Node Selected"], {"forceInput": False})}
                ,"optional": {"history": ("STRING", {"forceInput": False, "multiline": True, "tooltip": "dont put anything there"})}
                ,"hidden": {"id": "UNIQUE_ID",} 
        }
    RETURN_TYPES = ()
    FUNCTION = "show_history"
    # OUTPUT_NODE = True

    def show_history(self, node, history, id):
        message = "this is the message"
        print("message from show_history " + message)
        PromptServer.instance.send_sync("DisplayHistory.message", {
           "message":f"History: {message}"
        })

        # getting message back
        PromptServer.instance.send_sync("proxy", {
            "id":    id,
            "the_stuff": message 
        })
        outputs = MessageHolder.waitForMessage(id)

        print(outputs)
        
        return {"ui": {"text": message}, "result": ("whaaaat",)}
    
    @classmethod
    def VALIDATE_INPUTS(s, input_types):
        # YOLO, anything goes!
        return True

    def IS_CHANGED(id):
        return float("NaN")


class ClientProxy:
  def __init__(self): pass

  @classmethod
  def INPUT_TYPES(s):
    return {
      "required": {},
      "optional": {
        "input": ("INT", {}),
      },
      "hidden": {
        "id": "UNIQUE_ID",
      }
    }

  CATEGORY = "proxies"
  FUNCTION = "run"
  RETURN_TYPES = ("INT",)
  RETURN_NAMES = ("out",)

  def IS_CHANGED(id):
    return float("NaN")
  
  def run(self, id, input):
    # me = prompt[id]
    PromptServer.instance.send_sync("proxy", {
      "id":    id,
      "input": input,
    })
    outputs = MessageHolder.waitForMessage(id)
    print(outputs)
    return (outputs['output'],)
  

# Message Handling

class MessageHolder:
  messages = {}

  @classmethod
  def addMessage(self, id, message):
    self.messages[str(id)] = message

  @classmethod
  def waitForMessage(self, id, period = 0.1):
    sid = str(id)

    while not (sid in self.messages):
      time.sleep(period)

    message = self.messages.pop(str(id),None)
    return message


routes = PromptServer.instance.routes
@routes.post('/proxy_reply')
async def proxy_handle(request):
  post = await request.json()
  MessageHolder.addMessage(post["node_id"], post["outputs"])
  return web.json_response({"status": "ok"})
    

class ImageSelector:
    CATEGORY = "example"
    @classmethod    
    def INPUT_TYPES(s):
        return { "required":  { "images": ("IMAGE",), 
                            "mode": (["brightest", "reddest", "greenest", "bluest"],)} }
    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "choose_image"

    def choose_image(self, images, mode):
        batch_size = images.shape[0]
        brightness = list(torch.mean(image.flatten()).item() for image in images)
        if (mode=="brightest"):
            scores = brightness
        else:
            channel = 0 if mode=="reddest" else (1 if mode=="greenest" else 2)
            absolute = list(torch.mean(image[:,:,channel].flatten()).item() for image in images)
            scores = list( absolute[i]/(brightness[i]+1e-8) for i in range(batch_size) )
        best = scores.index(max(scores))
        result = images[best].unsqueeze(0)

        PromptServer.instance.send_sync("example.imageselector.textmessage", {"message":f"Picked image {best+1}"})
        return (result,)





# A dictionary that contains all nodes you want to export with their names
# NOTE: names should be globally unique
NODE_CLASS_MAPPINGS = {
    "Example": Example,
    "DisplayHistory": DisplayHistory,
    "Image Selector" : ImageSelector,
    "Client Proxy": ClientProxy,
}

# A dictionary that contains the friendly/humanly readable titles for the nodes
NODE_DISPLAY_NAME_MAPPINGS = {
    "Example": "Example Node",
    "DisplayHistory": "Display History",
    "Image Selector": "Image Selector",
    "Client Proxy": "Client Proxy Node"
}

